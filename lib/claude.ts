import Anthropic from '@anthropic-ai/sdk'
import { Client, Invoice, InvoiceInterpretation } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an invoicing assistant for Miller Painting, a professional painting business.
Your job is to help create invoices by interpreting spoken requests from the business owner.

When given a voice transcript, extract:
1. Client name (match against the provided client list if possible)
2. Line items (description, quantity, rate, amount)
3. Any notes or special instructions

Common patterns for this painting business:
- "X days labor at $Y a day" → quantity=X, rate=Y, amount=X*Y, description="Labor"
- "X hours at $Y an hour" → hourly labor
- "paint job on [room]" → add as description note on the labor line item, not a separate line item unless priced separately
- Rates may be given as "400 a day", "400/day", "400 per day" — all equivalent

Rules:
- If the client name doesn't match anyone in the client list, set client to null and populate client_name_mentioned with the raw name
- If critical information is missing (like rate or quantity), set clarification_needed to true and ask one specific question
- Always compute amount = quantity * rate for each line item
- Be friendly and conversational in assistant_message — you're talking to a small business owner on their phone
- If the current invoice has existing line items and the user says "make it X days instead", update the relevant line item

Return ONLY valid JSON matching this exact schema, no markdown, no explanation:
{
  "client": <Client object from the list, or null>,
  "client_name_mentioned": <string or null>,
  "line_items": [{"description": string, "quantity": number, "rate": number, "amount": number}],
  "notes": <string or null>,
  "clarification_needed": boolean,
  "clarification_question": <string or null>,
  "confidence": "high" | "medium" | "low",
  "assistant_message": string
}`

export async function interpretInvoiceRequest(
  transcript: string,
  clients: Client[],
  currentInvoice: Partial<Invoice> | null
): Promise<InvoiceInterpretation> {
  const userMessage = `Voice transcript: "${transcript}"

Available clients:
${JSON.stringify(clients, null, 2)}

Current invoice state (null if new):
${JSON.stringify(currentInvoice, null, 2)}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    return JSON.parse(text) as InvoiceInterpretation
  } catch {
    return {
      client: null,
      line_items: [],
      clarification_needed: true,
      clarification_question: "Sorry, I couldn't parse that. Could you try again?",
      confidence: 'low',
      assistant_message: text || "I had trouble understanding that. Could you try again?",
    }
  }
}
