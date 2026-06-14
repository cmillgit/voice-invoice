-- Security hardening (addresses Supabase advisor warnings)

-- Pin search_path on our functions so they can't be hijacked by a mutable role search_path.
-- All object references inside these functions are already schema-qualified.
alter function public.set_updated_at()               set search_path = '';
alter function public.recalc_invoice_totals(uuid)    set search_path = '';
alter function public.trg_line_items_recalc()        set search_path = '';
alter function public.trg_invoice_materials_recalc() set search_path = '';

-- rls_auto_enable() is an event-trigger helper (auto-enables RLS on new public tables).
-- It has no use as a callable REST RPC; revoke execute to remove it from the exposed API surface.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
