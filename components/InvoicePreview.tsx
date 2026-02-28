'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Invoice, Client } from '@/lib/types'

interface InvoicePreviewProps {
  invoice: Partial<Invoice> | null
  client: Client | null
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function InvoicePreview({ invoice, client }: InvoicePreviewProps) {
  const [expanded, setExpanded] = useState(false)

  const hasItems = (invoice?.line_items?.length ?? 0) > 0

  if (!hasItems && !client) {
    return null
  }

  return (
    <div className="mx-4 mb-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Invoice</span>
          <span className="font-semibold text-gray-900">
            {client?.name ?? 'Unknown client'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasItems && (
            <span className="text-lg font-bold text-gray-900">
              {usd(invoice?.total ?? invoice?.subtotal ?? 0)}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && hasItems && (
        <div className="border-t border-gray-100 px-4 pb-4">
          <table className="w-full mt-3 text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase">
                <th className="text-left pb-2 font-medium">Description</th>
                <th className="text-right pb-2 font-medium">Qty</th>
                <th className="text-right pb-2 font-medium">Rate</th>
                <th className="text-right pb-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice!.line_items!.map((item, i) => (
                <tr key={i}>
                  <td className="py-2 text-gray-800">{item.description}</td>
                  <td className="py-2 text-right text-gray-600">{item.quantity}</td>
                  <td className="py-2 text-right text-gray-600">{usd(item.rate)}</td>
                  <td className="py-2 text-right text-gray-900 font-medium">{usd(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{usd(invoice!.subtotal ?? 0)}</span>
            </div>
            {(invoice?.tax_rate ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax</span>
                <span>{usd(invoice!.tax_amount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1">
              <span>Total</span>
              <span>{usd(invoice!.total ?? invoice!.subtotal ?? 0)}</span>
            </div>
          </div>

          {invoice?.notes && (
            <p className="mt-3 text-xs text-gray-500 italic">{invoice.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}
