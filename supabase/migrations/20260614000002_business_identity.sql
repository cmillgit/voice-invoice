-- Business identity ("bill-from") — closes the gap flagged in VISION §5/§10 after
-- reviewing real invoices: the app had no stored business name/address/phone, and no
-- "from" block on the document at all.

create table public.business_profile (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  address     text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.business_profile is
  'Single-user business identity ("bill from") shown on invoices and PDFs. One row per user.';

create trigger business_profile_set_updated_at
  before update on public.business_profile
  for each row execute function public.set_updated_at();

alter table public.business_profile enable row level security;
create policy business_profile_owner_all on public.business_profile
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.business_profile to authenticated;

-- Snapshot business identity onto each invoice at issue time — same "record integrity"
-- pattern already used for client_name/client_address/client_account_id, so a later edit
-- to the business profile never rewrites the letterhead on an already-issued invoice.
alter table public.invoices add column business_name text;
alter table public.invoices add column business_address text;
alter table public.invoices add column business_phone text;
