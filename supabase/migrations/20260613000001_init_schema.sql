-- VoiceInvoice — initial schema (phase 1)
-- Embodies VISION.md §5: deterministic, backend-computed money. Rate config is stored as
-- STRUCTURED PARAMETERS (rate_type enum + numeric amount), never as executable SQL strings.
-- Line-item and invoice totals are computed by the database, never by the LLM or the client.
-- Single-user for now, but every row is scoped by user_id so a second login is config, not a rewrite.

-- ---------------------------------------------------------------------------
-- shared helper: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clients (client master): contact info + identity synonyms
-- ---------------------------------------------------------------------------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  address     text,
  account_id  text,
  synonyms    text[] not null default '{}',   -- natural-language aliases for client identity (voice resolution)
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.clients is 'Client master: contact info, identity synonyms, and (via client_rates) default rate structures.';

create index clients_user_id_idx on public.clients(user_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- client_rates: structured rate definitions (NO executable SQL — see VISION §5)
-- ---------------------------------------------------------------------------
create table public.client_rates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  rate_type   text not null check (rate_type in ('hourly','per_sqft')),  -- closed enum; extensible later
  rate_amount numeric(12,2) not null check (rate_amount >= 0),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
comment on table public.client_rates is 'Per-client rate structures as structured parameters. Phase 1: hourly, per_sqft. Interpreted by deterministic backend calc.';

create index client_rates_client_id_idx on public.client_rates(client_id);
create index client_rates_user_id_idx on public.client_rates(user_id);
-- at most one default rate per client
create unique index client_rates_one_default_per_client
  on public.client_rates(client_id) where is_default;

-- ---------------------------------------------------------------------------
-- invoices: written only on user approval; client identity snapshotted for record integrity
-- ---------------------------------------------------------------------------
create table public.invoices (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id         uuid references public.clients(id) on delete set null,
  invoice_number    text not null,
  issue_date        date not null default current_date,
  status            text not null default 'issued' check (status in ('issued')),
  client_name       text not null,            -- snapshot at issue time
  client_address    text,
  client_account_id text,
  materials_total   numeric(12,2) not null default 0 check (materials_total >= 0),
  subtotal          numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, invoice_number)
);
comment on table public.invoices is 'Issued invoices (persisted only on explicit user approval). Totals computed deterministically by triggers.';

create index invoices_user_id_idx on public.invoices(user_id);
create index invoices_client_id_idx on public.invoices(client_id);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- invoice_line_items: amount is DB-computed (deterministic money)
-- ---------------------------------------------------------------------------
create table public.invoice_line_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  position    int not null default 0,
  description text not null,
  rate_type   text not null check (rate_type in ('hourly','per_sqft')),
  quantity    numeric(12,2) not null check (quantity >= 0),
  rate_amount numeric(12,2) not null check (rate_amount >= 0),
  amount      numeric(12,2) generated always as (round(quantity * rate_amount, 2)) stored,
  is_flagged  boolean not null default false,  -- agent best-guess flag, surfaced in review
  flag_note   text,
  created_at  timestamptz not null default now()
);
comment on table public.invoice_line_items is 'Line items. amount = round(quantity * rate_amount, 2), computed by the DB — never LLM-produced.';

create index invoice_line_items_invoice_id_idx on public.invoice_line_items(invoice_id);
create index invoice_line_items_user_id_idx on public.invoice_line_items(user_id);

-- ---------------------------------------------------------------------------
-- deterministic total recomputation
-- ---------------------------------------------------------------------------
create or replace function public.recalc_invoice_totals(p_invoice_id uuid)
returns void language plpgsql as $$
declare
  v_subtotal numeric(12,2);
begin
  select coalesce(sum(amount), 0) into v_subtotal
    from public.invoice_line_items where invoice_id = p_invoice_id;
  update public.invoices
    set subtotal = v_subtotal,
        total    = v_subtotal + materials_total
  where id = p_invoice_id;
end;
$$;

create or replace function public.trg_line_items_recalc()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalc_invoice_totals(old.invoice_id);
    return old;
  end if;
  perform public.recalc_invoice_totals(new.invoice_id);
  return new;
end;
$$;

create trigger line_items_recalc
  after insert or update or delete on public.invoice_line_items
  for each row execute function public.trg_line_items_recalc();

-- keep total correct when materials_total changes directly on the invoice
create or replace function public.trg_invoice_materials_recalc()
returns trigger language plpgsql as $$
begin
  new.total := new.subtotal + new.materials_total;
  return new;
end;
$$;

create trigger invoice_materials_recalc
  before update of materials_total on public.invoices
  for each row execute function public.trg_invoice_materials_recalc();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user sees only their own rows
-- ---------------------------------------------------------------------------
alter table public.clients            enable row level security;
alter table public.client_rates       enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_line_items enable row level security;

create policy clients_owner_all on public.clients
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy client_rates_owner_all on public.client_rates
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy invoices_owner_all on public.invoices
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy invoice_line_items_owner_all on public.invoice_line_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
