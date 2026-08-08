-- Schema fit-check against 6 real RAM Painting & Construction invoices (2026-06-14).
--
-- Findings that required a schema change:
--  1. 3 of 6 real invoices bill a single lump-sum job price (not hourly, not per_sqft).
--     Add 'flat' as a third rate_type.
--  2. EVERY real invoice includes a "HOLDBACK" / retention deduction line (a construction-
--     industry practice: the builder withholds a flat $ or % until touchup/punch-list is
--     done). invoice_line_items.rate_amount currently requires >= 0, which blocks this
--     entirely. Add an explicit is_deduction flag and relax the constraint only for
--     deduction lines — normal service lines still can't go negative.
--  3. 100% of real invoices state payment terms ("Due on receipt", "NET 5"). Add a column.

-- ---------------------------------------------------------------------------
-- 1 & 2a. rate_type: add 'flat' (client defaults + line items)
-- ---------------------------------------------------------------------------
alter table public.client_rates drop constraint client_rates_rate_type_check;
alter table public.client_rates add constraint client_rates_rate_type_check
  check (rate_type in ('hourly', 'per_sqft', 'flat'));

alter table public.invoice_line_items drop constraint invoice_line_items_rate_type_check;
alter table public.invoice_line_items add constraint invoice_line_items_rate_type_check
  check (rate_type in ('hourly', 'per_sqft', 'flat'));

-- ---------------------------------------------------------------------------
-- 2b. Holdback / retention deduction lines
-- ---------------------------------------------------------------------------
alter table public.invoice_line_items add column is_deduction boolean not null default false;

comment on column public.invoice_line_items.is_deduction is
  'True for holdback/retention deduction lines (negative rate_amount). Standard construction-'
  'billing practice: a flat $ or % withheld from the invoice until touchup/punch-list work is '
  'complete. Set manually — the voice agent does not compute or invent deduction amounts.';

alter table public.invoice_line_items drop constraint invoice_line_items_rate_amount_check;
alter table public.invoice_line_items add constraint invoice_line_items_rate_amount_check
  check (is_deduction or rate_amount >= 0);

-- ---------------------------------------------------------------------------
-- 3. Payment terms
-- ---------------------------------------------------------------------------
alter table public.invoices add column payment_terms text;
comment on column public.invoices.payment_terms is
  'Free text, e.g. "Due on receipt" or "NET 5". Present on 100% of sampled real invoices.';
