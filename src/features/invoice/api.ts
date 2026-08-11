import { supabase } from '../../lib/supabase';
import { nextInvoiceNumber } from '../../lib/invoiceNumber';
import type { BusinessProfile, Invoice, InvoiceDraft } from '../../lib/types';

/**
 * Persist an invoice as a draft or as issued. Runs on explicit user action — either
 * "Save draft" or "Approve & issue" (VISION §4.3, updated to allow draft saves and
 * plain in-place editing).
 * Totals are NOT sent from the client — the database computes line amounts (generated
 * column) and invoice subtotal/total (triggers). We write inputs; the DB owns the money.
 *
 * `business` is snapshotted onto the row (business_name/address/phone) the same way
 * client identity is, so a later edit to the business profile never rewrites the
 * letterhead on an already-issued invoice.
 */
export interface SaveInvoiceOptions {
  id?: string | null;
  status: 'draft' | 'issued';
}

export async function saveInvoice(
  draft: InvoiceDraft,
  business: BusinessProfile | null,
  opts: SaveInvoiceOptions,
): Promise<Invoice> {
  const invoiceFields = {
    client_id: draft.client_id,
    issue_date: draft.issue_date,
    status: opts.status,
    client_name: draft.client_name,
    client_address: draft.client_address,
    client_account_id: draft.client_account_id,
    materials_total: draft.materials_total,
    job_label: draft.job_label,
    notes: draft.notes,
    business_name: business?.name ?? null,
    business_address: business?.address ?? null,
    business_phone: business?.phone ?? null,
  };

  let invoiceId: string;
  if (opts.id) {
    // Edit path: update the row, then clear its line items — the fresh insert below
    // is what fires the recalc trigger that produces the final persisted totals.
    const { error } = await supabase.from('invoices').update(invoiceFields).eq('id', opts.id);
    if (error) throw error;
    invoiceId = opts.id;
    const { error: delErr } = await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
    if (delErr) throw delErr;
  } else {
    // First save (draft or issue) — allocate the invoice number now, regardless of status.
    const invoice_number = await nextInvoiceNumber();
    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({ ...invoiceFields, invoice_number })
      .select('id')
      .single();
    if (error) throw error;
    invoiceId = inv.id;
  }

  if (draft.line_items.length > 0) {
    const { error } = await supabase.from('invoice_line_items').insert(
      draft.line_items.map((li, i) => ({
        invoice_id: invoiceId,
        position: i,
        description: li.description,
        rate_type: li.rate_type,
        quantity: li.quantity,
        rate_amount: li.rate_amount,
        is_flagged: li.is_flagged ?? false,
        flag_note: li.flag_note ?? null,
        is_deduction: li.is_deduction ?? false,
      })),
    );
    if (error) throw error;
  }

  // Re-read so we get DB-computed amounts and totals (the authoritative numbers).
  const { data: full, error: readErr } = await supabase
    .from('invoices')
    .select('*, line_items:invoice_line_items(*)')
    .eq('id', invoiceId)
    .single();
  if (readErr) throw readErr;
  return full as Invoice;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, line_items:invoice_line_items(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Invoice;
}
