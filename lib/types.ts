export type RateType = 'hourly' | 'day' | 'flat'
export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export interface Client {
  id: string
  name: string
  email: string
  address?: string
  account_id?: string
  rate_type: RateType
  default_rate: number
  notes?: string
  created_at: string
}

export interface LineItem {
  description: string
  quantity: number
  rate: number
  amount: number // quantity * rate
}

export interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  status: InvoiceStatus
  line_items: LineItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  notes?: string
  sent_at?: string
  paid_at?: string
  created_at: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface InvoiceInterpretation {
  client?: Client | null
  client_name_mentioned?: string // raw name if not found in client list
  line_items: LineItem[]
  notes?: string
  clarification_needed: boolean
  clarification_question?: string
  confidence: 'high' | 'medium' | 'low'
  assistant_message: string // conversational reply shown in the UI
}
