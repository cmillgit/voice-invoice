import { NextRequest, NextResponse } from 'next/server'
import { interpretInvoiceRequest } from '@/lib/claude'
import { Client, Invoice } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      transcript: string
      clients: Client[]
      currentInvoice: Partial<Invoice> | null
    }

    if (!body.transcript?.trim()) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })
    }

    const interpretation = await interpretInvoiceRequest(
      body.transcript,
      body.clients ?? [],
      body.currentInvoice ?? null
    )

    return NextResponse.json(interpretation)
  } catch (err) {
    console.error('[interpret]', err)
    return NextResponse.json(
      { error: 'AI interpretation failed. Please try again.' },
      { status: 500 }
    )
  }
}
