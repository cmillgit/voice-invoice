// Phase-1 invoice numbering: YYYYMMDD-NN, sequential within the day, per user.
// VISION §7 flags this as provisional — likely to be replaced by the father's real
// convention. Kept isolated here so swapping the scheme touches one file.

import { supabase } from './supabase';

function datePart(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** Compute the next available invoice number for today for the current user. */
export async function nextInvoiceNumber(): Promise<string> {
  const prefix = datePart();
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  if (error) throw error;

  let next = 1;
  if (data && data.length > 0) {
    const last = data[0].invoice_number.split('-')[1];
    const n = parseInt(last, 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}-${String(next).padStart(2, '0')}`;
}
