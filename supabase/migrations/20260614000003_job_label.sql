-- Formalize "job / project" as a first-class field, separate from freeform notes.
-- All 6 real invoices reviewed had a distinct JOB field (site address or project name) —
-- it was being stuffed into invoices.notes as a "Job: ..." prefix convention, which is not
-- a real field. This gives it a real column and moves it into a prominent document position
-- (see InvoiceDocument.tsx / InvoicePdf.tsx), leaving notes for genuine freeform remarks.

alter table public.invoices add column job_label text;
comment on column public.invoices.job_label is
  'Short job/project identifier or site address (e.g. "123 Main St", "Highland Pointe Model/Office '
  'Touchup"). Rendered prominently near the top of the document, above the line-item table.';
