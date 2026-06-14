// Deterministic preview arithmetic. This mirrors the database's computation so the
// live preview matches what will be persisted, but the DB remains the authority:
// line_items.amount is a generated column and invoice totals are set by triggers
// (see migration 20260613000001). This module is plain arithmetic — never the LLM.

import type { DraftLineItem, InvoiceDraft } from './types';

/** Round to 2 decimals, half away from zero — matches Postgres round(numeric, 2). */
export function round2(n: number): number {
  const s = n < 0 ? -1 : 1;
  return (s * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
}

export const lineAmount = (li: Pick<DraftLineItem, 'quantity' | 'rate_amount'>): number =>
  round2((li.quantity || 0) * (li.rate_amount || 0));

export const subtotal = (items: DraftLineItem[]): number =>
  round2(items.reduce((sum, li) => sum + lineAmount(li), 0));

export const invoiceTotal = (draft: Pick<InvoiceDraft, 'line_items' | 'materials_total'>): number =>
  round2(subtotal(draft.line_items) + (draft.materials_total || 0));
