-- Grant base table privileges to the authenticated role.
-- RLS is already enabled on every table, so these grants do NOT widen row access —
-- each user still only sees rows where user_id = auth.uid(). anon gets nothing.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.clients,
  public.client_rates,
  public.invoices,
  public.invoice_line_items
to authenticated;
