// parse-invoice — turns a dictated utterance into structured invoice inputs.
//
// VISION §5 (deterministic money): the LLM NEVER computes totals or invents rates.
// It extracts what was SAID — which client, what work, quantities, which rate type,
// and an explicit dollar rate ONLY if the user stated one out loud. The frontend
// resolves stored rates and the database computes all amounts.

import Anthropic from 'npm:@anthropic-ai/sdk';

// Lock to the deployed frontend origin via the ALLOWED_ORIGIN secret once known
// (e.g. https://voice-invoice.pages.dev). Defaults to '*' for local dev. Note the
// function is JWT-verified regardless, so '*' is not an open door — only callers
// with a valid Supabase session token can invoke it.
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

const MODEL = Deno.env.get('VOICEINVOICE_MODEL') ?? 'claude-opus-4-8';

interface ClientCtx {
  id: string;
  name: string;
  synonyms: string[];
  rates: { rate_type: string; rate_amount: number; is_default: boolean }[];
}

// Structured-output schema. All fields required; sentinels ("" / 0 / false) stand in
// for "not present" so we avoid nullable-schema complexity.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    client_id: { type: 'string', description: 'Resolved client id from the provided list, or "" if none matched.' },
    client_match: { type: 'string', enum: ['high', 'low', 'none'] },
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          rate_type: { type: 'string', enum: ['hourly', 'per_sqft'] },
          quantity: { type: 'number' },
          explicit_rate: { type: 'number', description: 'Dollar rate ONLY if the user explicitly stated one; otherwise 0 to use the client default.' },
          is_flagged: { type: 'boolean', description: 'true if this line involved a best-guess/assumption the user should review.' },
          flag_note: { type: 'string' },
        },
        required: ['description', 'rate_type', 'quantity', 'explicit_rate', 'is_flagged', 'flag_note'],
      },
    },
    materials_total: { type: 'number', description: 'Lump-sum materials cost if stated, else 0.' },
    notes: { type: 'string' },
    agent_message: { type: 'string', description: 'Short spoken+written reply: what you understood, and any flagged assumption.' },
    needs_clarification: { type: 'boolean' },
    clarifying_question: { type: 'string' },
  },
  required: [
    'client_id', 'client_match', 'line_items', 'materials_total',
    'notes', 'agent_message', 'needs_clarification', 'clarifying_question',
  ],
};

function systemPrompt(clients: ClientCtx[], currentDraft: unknown): string {
  return [
    'You are the invoicing assistant for VoiceInvoice, a voice-driven invoicing app for a single tradesperson.',
    'The user dictates the work performed; you extract structured invoice inputs from what they said.',
    '',
    'HARD RULES:',
    '- You NEVER compute totals, subtotals, or amounts. The application does all math deterministically.',
    '- You NEVER invent a rate. Set explicit_rate to a dollar value ONLY when the user explicitly says a rate aloud (e.g. "ninety dollars an hour"). Otherwise set explicit_rate to 0, which tells the app to use the client\'s stored default rate.',
    '- Phase 1 supports two rate types: "hourly" and "per_sqft". Map the work to one of these.',
    '- Resolve the client from the provided list using names AND synonyms. If you are not confident, set client_id to "" and client_match to "low" or "none" and ask a clarifying question.',
    '- When something is ambiguous (e.g. the unit is unclear, or you had to guess the rate type), make your best guess, set is_flagged=true, and explain briefly in flag_note. Do not stop the flow for minor ambiguity — flag it for review instead.',
    '- Only ask a clarifying question (needs_clarification=true) when a REQUIRED field is genuinely missing (no client, or no work described).',
    '- Keep agent_message short and natural — it is both shown and spoken aloud.',
    '',
    'STATE: line_items, materials_total, and notes you return REPLACE the current draft. Always return the COMPLETE invoice as understood so far, incorporating the latest message. If the user corrects one line ("make that two hours"), return all lines with that one corrected. If the user adds a line, return the existing lines plus the new one. Preserve the resolved client_id across turns unless the user changes it.',
    '',
    'Current draft (JSON):',
    JSON.stringify(currentDraft ?? {}),
    '',
    'Available clients (JSON):',
    JSON.stringify(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        synonyms: c.synonyms,
        rate_types: c.rates.map((r) => r.rate_type),
        default_rate_type: c.rates.find((r) => r.is_default)?.rate_type ?? null,
      })),
    ),
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return json({ error: 'Server not configured: ANTHROPIC_API_KEY is not set.' }, 500);
    }

    const { utterance, conversation = [], clients = [], current_draft = null } = await req.json();
    if (!utterance || typeof utterance !== 'string') {
      return json({ error: 'Missing "utterance".' }, 400);
    }

    const anthropic = new Anthropic({ apiKey });

    // Prior turns give the model context for follow-ups ("make that two hours not three").
    const history = (conversation as { role: 'user' | 'agent'; text: string }[])
      .map((t) => ({
        role: t.role === 'agent' ? ('assistant' as const) : ('user' as const),
        content: t.text,
      }));

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: SCHEMA }, effort: 'low' },
      system: systemPrompt(clients as ClientCtx[], current_draft),
      messages: [...history, { role: 'user', content: utterance }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return json({ error: 'No structured output returned.' }, 502);
    }

    return json({ parsed: JSON.parse(textBlock.text) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
