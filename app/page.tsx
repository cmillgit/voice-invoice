'use client'

import { useCallback, useEffect, useState } from 'react'
import { Client, ConversationMessage, Invoice, InvoiceInterpretation } from '@/lib/types'
import VoiceRecorder from '@/components/VoiceRecorder'
import ConversationThread from '@/components/ConversationThread'
import InvoicePreview from '@/components/InvoicePreview'
import ClientSelector from '@/components/ClientSelector'

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function Home() {
  const [clients, setClients] = useState<Client[]>([])
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [currentInvoice, setCurrentInvoice] = useState<Partial<Invoice> | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentInvoiceNumber, setSentInvoiceNumber] = useState<string | null>(null)

  // Load clients on mount
  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((data: Client[]) => {
        setClients(data)
        if (data.length === 1) setSelectedClient(data[0])
      })
      .catch(() => setError('Could not load clients. Check your Supabase connection.'))
  }, [])

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [
      ...prev,
      { role, content, timestamp: new Date().toISOString() },
    ])
  }, [])

  async function handleTranscript(transcript: string) {
    if (!transcript.trim()) {
      setError('No speech detected. Try again.')
      return
    }

    setError(null)
    addMessage('user', transcript)
    setIsProcessing(true)

    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          clients,
          currentInvoice,
        }),
      })

      const interpretation: InvoiceInterpretation = await res.json()

      if (!res.ok) {
        throw new Error((interpretation as { error?: string }).error ?? 'Interpretation failed')
      }

      addMessage('assistant', interpretation.assistant_message)

      // Update selected client if Claude identified one
      if (interpretation.client) {
        setSelectedClient(interpretation.client)
      } else if (interpretation.client_name_mentioned && clients.length > 0) {
        // Claude mentioned a name but couldn't match — show selector
      }

      // Update invoice state
      if (interpretation.line_items.length > 0) {
        const subtotal = interpretation.line_items.reduce((s, i) => s + i.amount, 0)
        const taxRate = currentInvoice?.tax_rate ?? 0
        const tax_amount = subtotal * taxRate

        setCurrentInvoice({
          ...currentInvoice,
          client_id: interpretation.client?.id ?? selectedClient?.id ?? '',
          line_items: interpretation.line_items,
          notes: interpretation.notes ?? currentInvoice?.notes,
          subtotal,
          tax_rate: taxRate,
          tax_amount,
          total: subtotal + tax_amount,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
      addMessage('assistant', `Sorry, I ran into a problem: ${msg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleSendInvoice() {
    const client = selectedClient
    if (!client || !currentInvoice?.line_items?.length) return

    const total = currentInvoice.total ?? currentInvoice.subtotal ?? 0
    const confirmed = window.confirm(
      `Send invoice to ${client.name} (${client.email}) for ${usd(total)}?`
    )
    if (!confirmed) return

    setIsSending(true)
    setError(null)

    try {
      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: currentInvoice, client }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invoice')

      setSentInvoiceNumber(data.invoiceNumber)
      addMessage('assistant', `Invoice ${data.invoiceNumber} sent to ${client.email}! 🎉`)

      // Reset invoice state for next one
      setCurrentInvoice(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invoice.'
      setError(msg)
    } finally {
      setIsSending(false)
    }
  }

  const invoiceReady =
    (currentInvoice?.line_items?.length ?? 0) > 0 && selectedClient !== null

  return (
    <main className="flex flex-col h-[100dvh] max-w-lg mx-auto">
      {/* Header */}
      <header className="shrink-0 bg-blue-700 text-white px-4 py-3 shadow-md">
        <h1 className="text-xl font-bold tracking-tight">Miller Painting</h1>
        <p className="text-sm text-blue-200">Voice Invoice</p>
      </header>

      {/* Conversation thread */}
      <div className="flex-1 overflow-y-auto">
        <ConversationThread messages={messages} isProcessing={isProcessing} />
      </div>

      {/* Invoice preview */}
      <InvoicePreview invoice={currentInvoice} client={selectedClient} />

      {/* Error bar */}
      {error && (
        <div className="shrink-0 mx-4 mb-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Success bar */}
      {sentInvoiceNumber && !error && (
        <div className="shrink-0 mx-4 mb-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-green-700 text-sm">
          Invoice {sentInvoiceNumber} sent successfully!
        </div>
      )}

      {/* Bottom controls */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-4 pt-3 pb-6 flex flex-col gap-3">
        {/* Send Invoice button */}
        {invoiceReady && (
          <button
            className="w-full h-14 rounded-2xl bg-green-600 text-white font-semibold text-lg
                       active:bg-green-800 disabled:opacity-50 transition-colors shadow-sm"
            onClick={handleSendInvoice}
            disabled={isSending}
          >
            {isSending ? 'Sending…' : `Send Invoice — ${usd(currentInvoice!.total ?? currentInvoice!.subtotal ?? 0)}`}
          </button>
        )}

        {/* Mic row */}
        <div className="flex items-center justify-center gap-4">
          <ClientSelector
            clients={clients}
            selected={selectedClient}
            onChange={setSelectedClient}
          />
          <VoiceRecorder
            onTranscriptReady={handleTranscript}
            disabled={isProcessing || isSending}
          />
        </div>
      </div>
    </main>
  )
}
