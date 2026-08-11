-- Product owner reversal: invoice editing is now allowed (plain in-place overwrite,
-- no versioning/audit trail — see VISION.md). This adds a 'draft' status so an
-- invoice can be saved before it's issued, and edited freely until issued.
alter table public.invoices drop constraint invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('draft', 'issued'));
alter table public.invoices alter column status set default 'draft';

comment on table public.invoices is
  'Invoices, draft or issued. A row is created on first Save draft or Approve & issue and can be freely edited afterward (plain overwrite, no versioning). Totals computed deterministically by triggers.';
