-- Client email addresses — data capture only. Where an invoice WOULD be sent, not an
-- email-sending feature (that stays deferred per VISION §10). Real invoices route to a
-- role/department ("Accts Payable"), not a person, so this is a flat list mirroring how
-- clients.synonyms already works — no separate table needed for phase 1.

alter table public.clients add column emails text[] not null default '{}';
comment on column public.clients.emails is
  'Email address(es) an invoice would be sent to. Data capture only in phase 1 - no send '
  'feature yet. Flat list (no To/Cc distinction) until sending is actually built.';
