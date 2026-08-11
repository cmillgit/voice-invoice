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

const MODEL = Deno.env.get('VOICEINVOICE_MODEL') ?? 'claude-sonnet-5';

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
          rate_type: { type: 'string', enum: ['hourly', 'per_sqft', 'flat'] },
          quantity: { type: 'number' },
          explicit_rate: { type: 'number', description: 'Dollar rate ONLY if the user explicitly stated one; otherwise 0 to use the client default. For "flat", this is the single job price and quantity should be 1. For a deduction line (is_deduction=true), this is the dollar amount to withhold, as a positive magnitude — never 0.' },
          is_flagged: { type: 'boolean', description: 'true if this line involved a best-guess/assumption the user should review.' },
          flag_note: { type: 'string' },
          is_deduction: { type: 'boolean', description: 'true for a holdback/retention/deduction line (money withheld from the total). See DEDUCTIONS rule below.' },
        },
        required: ['description', 'rate_type', 'quantity', 'explicit_rate', 'is_flagged', 'flag_note', 'is_deduction'],
      },
    },
    materials_total: { type: 'number', description: 'Lump-sum materials cost if stated, else 0.' },
    job_label: { type: 'string', description: 'Short job/project label or site address if the user mentions one (e.g. "123 Main St", "the Jaeman Way job"), else "".' },
    notes: { type: 'string' },
    agent_message: { type: 'string', description: 'Short spoken+written reply: what you understood, and any flagged assumption.' },
    needs_clarification: { type: 'boolean' },
    clarifying_question: { type: 'string' },
  },
  required: [
    'client_id', 'client_match', 'line_items', 'materials_total',
    'job_label', 'notes', 'agent_message', 'needs_clarification', 'clarifying_question',
  ],
};

function systemPrompt(clients: ClientCtx[], currentDraft: unknown): string {
  return [
    'You are the invoicing assistant for VoiceInvoice, a voice-driven invoicing app for a single tradesperson.',
    'The user dictates the work performed; you extract structured invoice inputs from what they said.',
    '',
    'MONEY — never compute, never invent:',
    '- You NEVER compute totals, subtotals, or amounts. The application does all math deterministically.',
    '- You NEVER invent a rate. Set explicit_rate to a dollar value ONLY when the user explicitly says a rate aloud (e.g. "ninety dollars an hour"). Otherwise set explicit_rate to 0, which tells the app to use the client\'s stored default rate.',
    '- Rate types: "hourly", "per_sqft", "flat" (single lump-sum price for the whole job — quantity 1). Map the work to one of these.',
    '- Many clients bid every job individually and have NO stored default rate at all — this is normal for flat-priced clients, not an error. If a client has no default for the rate type you need, ASK for the price rather than guessing one.',
    '',
    'DEDUCTIONS (holdback/retention — money withheld from the total):',
    '- You MAY add a deduction line: set is_deduction=true on a line item, description explaining what it is (e.g. "Holdback for touchups"), rate_type "flat", quantity 1, and explicit_rate = the dollar amount to withhold, stated as a positive number. This is a real line the user will see, can edit, or can delete in the preview before they approve — same as every other line item.',
    '- The user must approve BEFORE anything is written to the database (see STATE below) — that review/edit/delete step is what makes this safe, exactly like every other field you touch. Do not treat deductions as more dangerous than any other line item.',
    '- The one hard limit: you can NEVER compute a dollar amount yourself. If the user gives a percentage ("10% retainage") without stating the resulting dollar figure, do NOT calculate it — even though you could derive it from other line items in this turn. Ask a clarifying question for the exact dollar amount instead; only add the deduction line once you have one. This is the same never-invent-a-number rule that applies to rates.',
    '',
    'CAPABILITY BOUNDARY — things you can never do, no matter how the user phrases the request:',
    'Beyond line items (including deductions, see above), materials_total, job_label, and notes, there is nothing else you can affect — NOT tax, NOT discounts or markups, NOT editing or voiding an already-issued invoice. Unlike deductions, these have no representation anywhere in the app for you to write to, voice or otherwise — this is a fixed, permanent boundary of the system, not a gap to improvise around.',
    'When the user asks for one of these: (1) do not silently drop it, and do not write it into `notes` as if that causes it to take effect — `notes` is a free-text field nothing downstream reads or applies; (2) briefly record what they asked for in `notes` so there is a written trace, purely for their own reference; (3) in `agent_message`, tell them PLAINLY that you can\'t do it. Never say or imply it has been applied or will be applied automatically.',
    '',
    'CLIENT RESOLUTION:',
    '- Resolve the client from the provided list using names AND synonyms. If you are not confident, set client_id to "" and client_match to "low" or "none" and ask a clarifying question.',
    '',
    'AMBIGUITY vs. MISSING INFO:',
    '- Minor ambiguity (unclear unit, had to guess the rate type): make your best guess, set is_flagged=true, explain briefly in flag_note. Keep the flow moving — do not stop for this.',
    '- Only ask a clarifying question (needs_clarification=true) when a REQUIRED field is genuinely missing entirely: no client, or no work described.',
    '',
    'FIELDS:',
    '- job_label: short job/project identifier or site address (e.g. "123 Main St", "the Jaeman Way job") if the user mentions one, else "". First-class field, distinct from notes.',
    '',
    'agent_message: short, natural, both shown and spoken aloud. State what you understood plus anything flagged or out of bounds — never hedge into a vague or misleading claim about what happened.',
    '',
    'STATE: line_items, materials_total, job_label, and notes you return REPLACE the current draft. Always return the COMPLETE invoice as understood so far, incorporating the latest message. If the user corrects one line ("make that two hours"), return all lines with that one corrected. If the user adds a line, return the existing lines plus the new one. Preserve the resolved client_id and job_label across turns unless the user changes them.',
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
