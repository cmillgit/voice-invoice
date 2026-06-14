import { supabase } from '../../lib/supabase';
import type { Client, RateType } from '../../lib/types';

export interface RateInput {
  rate_type: RateType;
  rate_amount: number;
  is_default: boolean;
}

export interface ClientInput {
  name: string;
  address: string | null;
  account_id: string | null;
  synonyms: string[];
  notes: string | null;
  rates: RateInput[];
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*, client_rates(*)')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function createClient(input: ClientInput): Promise<string> {
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: input.name,
      address: input.address,
      account_id: input.account_id,
      synonyms: input.synonyms,
      notes: input.notes,
    })
    .select('id')
    .single();
  if (error) throw error;
  const clientId = data.id as string;
  await replaceRates(clientId, input.rates);
  return clientId;
}

export async function updateClient(id: string, input: ClientInput): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({
      name: input.name,
      address: input.address,
      account_id: input.account_id,
      synonyms: input.synonyms,
      notes: input.notes,
    })
    .eq('id', id);
  if (error) throw error;
  await replaceRates(id, input.rates);
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

/** Replace all rate rows for a client (simple + correct for small rate sets). */
async function replaceRates(clientId: string, rates: RateInput[]): Promise<void> {
  const del = await supabase.from('client_rates').delete().eq('client_id', clientId);
  if (del.error) throw del.error;
  if (rates.length === 0) return;
  const ins = await supabase.from('client_rates').insert(
    rates.map((r) => ({
      client_id: clientId,
      rate_type: r.rate_type,
      rate_amount: r.rate_amount,
      is_default: r.is_default,
    })),
  );
  if (ins.error) throw ins.error;
}
