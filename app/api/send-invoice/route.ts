import { NextRequest, NextResponse } from 'next/server'
import { generateInvoicePDF } from '@/lib/pdf'
import { sendInvoiceEmail } from '@/lib/resend'
import { createServerClient } from '@/lib/supabase'
import { Invoice, Client } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { invoice, client } = await request.json() as {
      invoice: Omit<Invoice, 'id' | 'invoice_number' | 'created_at'>
      client: Client
    }

    if (!client?.email) {
      return NextResponse.json({ error: 'Client email is required to send invoice' }, { status: 400 })
    }

    if (!invoice?.line_items?.length) {
      return NextResponse.json({ error: 'Invoice must have at least one line item' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Generate invoice number: INV-YYYYMMDD-XXX
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .ilike('invoice_number', `INV-${datePart}-%`)

    const seq = String((count ?? 0) + 1).padStart(3, '0')
    const invoiceNumber = `INV-${datePart}-${seq}`

    // Recompute totals server-side
    const subtotal = invoice.line_items.reduce((sum, item) => sum + item.amount, 0)
    const taxRate = invoice.tax_rate ?? 0
    const tax_amount = subtotal * taxRate
    const total = subtotal + tax_amount

    const fullInvoice: Invoice = {
      ...invoice,
      id: '',
      invoice_number: invoiceNumber,
      subtotal,
      tax_rate: taxRate,
      tax_amount,
      total,
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(fullInvoice, client)

    // Send email
    await sendInvoiceEmail(client.email, client.name, invoiceNumber, pdfBuffer)

    // Save to database (non-blocking on failure — email already sent)
    const { error: dbError } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      client_id: client.id,
      status: 'sent',
      line_items: fullInvoice.line_items,
      subtotal,
      tax_rate: taxRate,
      tax_amount,
      total,
      notes: fullInvoice.notes ?? null,
      sent_at: fullInvoice.sent_at,
    })

    if (dbError) {
      console.error('[send-invoice] DB insert failed:', dbError)
    }

    return NextResponse.json({ invoiceNumber })
  } catch (err) {
    console.error('[send-invoice]', err)
    return NextResponse.json(
      { error: 'Failed to send invoice. Please try again.' },
      { status: 500 }
    )
  }
}
