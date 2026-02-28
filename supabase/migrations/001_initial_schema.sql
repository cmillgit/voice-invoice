-- Enable UUID generation
create extension if not exists "pgcrypto";

-- clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  address text,
  account_id text unique,
  rate_type text not null check (rate_type in ('hourly', 'day', 'flat')),
  default_rate numeric(10,2) not null,
  notes text,
  created_at timestamptz default now()
);

-- invoices
create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  client_id uuid references clients(id),
  status text default 'draft' check (status in ('draft', 'sent', 'paid')),
  line_items jsonb not null default '[]',
  subtotal numeric(10,2),
  tax_rate numeric(5,4) default 0,
  tax_amount numeric(10,2) default 0,
  total numeric(10,2),
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table clients enable row level security;
alter table invoices enable row level security;

-- Permissive policies: single-user app, tighten later with auth.uid() if needed
create policy "Allow all for anon" on clients
  for all to anon using (true) with check (true);

create policy "Allow all for authenticated" on clients
  for all to authenticated using (true) with check (true);

create policy "Allow all for anon" on invoices
  for all to anon using (true) with check (true);

create policy "Allow all for authenticated" on invoices
  for all to authenticated using (true) with check (true);
