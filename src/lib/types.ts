// Domain types — mirror the DB schema (supabase/migrations/). Keep in sync with the
// database; these are the contract the UI builds against.

// 'flat' added 2026-06-14 after reviewing 6 real invoices: half of them bill a single
// lump-sum job price (not hourly, not per-sqft) — see supabase/migrations/20260614000001.
export type RateType = 'hourly' | 'per_sqft' | 'flat';

export const RATE_TYPES: { value: RateType; label: string; unit: string }[] = [
  { value: 'hourly', label: 'Hourly', unit: 'hr' },
  { value: 'per_sqft', label: 'Per sq ft', unit: 'sq ft' },
  { value: 'flat', label: 'Flat / per job', unit: 'job' },
];

export function rateTypeLabel(t: RateType): string {
  return RATE_TYPES.find((r) => r.value === t)?.label ?? t;
}
export function rateTypeUnit(t: RateType): string {
  return RATE_TYPES.find((r) => r.value === t)?.unit ?? '';
}

export interface ClientRate {
  id: string;
  client_id: string;
  rate_type: RateType;
  rate_amount: number;
  is_default: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  account_id: string | null;
  synonyms: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_rates?: ClientRate[];
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  rate_type: RateType;
  quantity: number;
  rate_amount: number;
  amount: number; // DB-generated
  is_flagged: boolean;
  flag_note: string | null;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  issue_date: string;
  status: 'issued';
  client_name: string;
  client_address: string | null;
  client_account_id: string | null;
  materials_total: number;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
  line_items?: InvoiceLineItem[];
}

// ---- Draft shapes (frontend-only, before approval/write) -------------------

export interface DraftLineItem {
  description: string;
  rate_type: RateType;
  quantity: number;
  rate_amount: number;
  is_flagged?: boolean;
  flag_note?: string | null;
}

export interface InvoiceDraft {
  client_id: string | null;
  client_name: string;
  client_address: string | null;
  client_account_id: string | null;
  issue_date: string; // YYYY-MM-DD
  line_items: DraftLineItem[];
  materials_total: number;
  notes: string | null;
}
