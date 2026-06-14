import { supabase } from '../../lib/supabase';
import { nextInvoiceNumber } from '../../lib/invoiceNumber';
import type { Invoice, InvoiceDraft } from '../../lib/types';

/**
 * Persist an approved invoice. This runs ONLY on explicit user approval (VISION §4.3).
 * Totals are NOT sent from the client — the database computes line amounts (generated
 * column) and invoice subtotal/total (triggers). We write inputs; the DB owns the money.
 */
export async function approveInvoice(draft: InvoiceDraft): Promise<Invoice> {
  const invoice_number = await nextInvoiceNumber();

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      client_id: draft.client_id,
      invoice_number,
      issue_date: draft.issue_date,
      client_name: draft.client_name,
      client_address: draft.client_address,
      client_account_id: draft.client_account_id,
      materials_total: draft.materials_total,
      notes: draft.notes,
    })
    .select('*')
    .single();
  if (invErr) throw invErr;

  if (draft.line_items.length > 0) {
    const { error: liErr } = await supabase.from('invoice_line_items').insert(
      draft.line_items.map((li, i) => ({
        invoice_id: inv.id,
        position: i,
        description: li.description,
        rate_type: li.rate_type,
        quantity: li.quantity,
        rate_amount: li.rate_amount,
        is_flagged: li.is_flagged ?? false,
        flag_note: li.flag_note ?? null,
      })),
    );
    if (liErr) throw liErr;
  }

  // Re-read so we get DB-computed amounts and totals (the authoritative numbers).
  const { data: full, error: readErr } = await supabase
    .from('invoices')
    .select('*, line_items:invoice_line_items(*)')
    .eq('id', inv.id)
    .single();
  if (readErr) throw readErr;
  return full as Invoice;
}
