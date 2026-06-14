import { supabase } from '../../lib/supabase';
import type { Client, DraftLineItem, InvoiceDraft, RateType } from '../../lib/types';

// Shape returned by the parse-invoice Edge Function (mirrors its JSON schema).
interface ParsedLineItem {
  description: string;
  rate_type: RateType;
  quantity: number;
  explicit_rate: number; // 0 → use client default
  is_flagged: boolean;
  flag_note: string;
}
interface Parsed {
  client_id: string;
  client_match: 'high' | 'low' | 'none';
  line_items: ParsedLineItem[];
  materials_total: number;
  notes: string;
  agent_message: string;
  needs_clarification: boolean;
  clarifying_question: string;
}

export interface Turn { role: 'user' | 'agent'; text: string }

function clientContext(clients: Client[]) {
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    synonyms: c.synonyms,
    rates: (c.client_rates ?? []).map((r) => ({
      rate_type: r.rate_type, rate_amount: r.rate_amount, is_default: r.is_default,
    })),
  }));
}

/** Call the agent, then deterministically resolve rates and merge into the draft. */
export async function runAgentTurn(args: {
  utterance: string;
  conversation: Turn[];
  clients: Client[];
  draft: InvoiceDraft;
}): Promise<{ draft: InvoiceDraft; agentMessage: string }> {
  const { utterance, conversation, clients, draft } = args;

  const { data, error } = await supabase.functions.invoke('parse-invoice', {
    body: {
      utterance,
      conversation,
      clients: clientContext(clients),
      current_draft: {
        client_id: draft.client_id,
        line_items: draft.line_items,
        materials_total: draft.materials_total,
        notes: draft.notes,
      },
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  const parsed = data?.parsed as Parsed | undefined;
  if (!parsed) throw new Error('The assistant returned an unexpected response.');

  const next: InvoiceDraft = { ...draft };

  // Client resolution (deterministic lookup by id the model chose).
  const resolved = parsed.client_id ? clients.find((c) => c.id === parsed.client_id) : null;
  if (resolved) {
    next.client_id = resolved.id;
    next.client_name = resolved.name;
    next.client_address = resolved.address;
    next.client_account_id = resolved.account_id;
  }

  // Rates are resolved HERE, never by the model: explicit rate if stated, else the
  // client's stored rate for that type (default-of-type first), else 0.
  const rateLookup = (rateType: RateType): number => {
    const rates = resolved?.client_rates ?? [];
    const match = rates.find((r) => r.rate_type === rateType);
    return match?.rate_amount ?? 0;
  };

  next.line_items = parsed.line_items.map((li): DraftLineItem => ({
    description: li.description,
    rate_type: li.rate_type,
    quantity: li.quantity,
    rate_amount: li.explicit_rate > 0 ? li.explicit_rate : rateLookup(li.rate_type),
    is_flagged: li.is_flagged,
    flag_note: li.flag_note || null,
  }));

  if (typeof parsed.materials_total === 'number') next.materials_total = parsed.materials_total;
  if (parsed.notes) next.notes = parsed.notes;

  const agentMessage = parsed.needs_clarification && parsed.clarifying_question
    ? parsed.clarifying_question
    : parsed.agent_message;

  return { draft: next, agentMessage };
}
