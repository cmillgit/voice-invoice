'use client'

import { Client } from '@/lib/types'

interface ClientSelectorProps {
  clients: Client[]
  selected: Client | null
  onChange: (client: Client | null) => void
}

export default function ClientSelector({ clients, selected, onChange }: ClientSelectorProps) {
  if (clients.length <= 1) return null

  return (
    <select
      className="h-12 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700
                 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[160px]"
      value={selected?.id ?? ''}
      onChange={(e) => {
        const client = clients.find((c) => c.id === e.target.value) ?? null
        onChange(client)
      }}
    >
      <option value="">Select client…</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
