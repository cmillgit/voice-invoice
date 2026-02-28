'use client'

import { useEffect, useRef } from 'react'
import { ConversationMessage } from '@/lib/types'

interface ConversationThreadProps {
  messages: ConversationMessage[]
  isProcessing: boolean
}

export default function ConversationThread({ messages, isProcessing }: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isProcessing])

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl">
          🎙️
        </div>
        <p className="text-gray-500 text-sm leading-relaxed">
          Hold the mic button and say who you&apos;re invoicing, what was done, and the amount.
        </p>
        <p className="text-gray-400 text-xs">
          e.g. &ldquo;Invoice John Smith, 3 days labor at $400 a day&rdquo;
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`
              max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
              ${msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
              }
            `}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {isProcessing && (
        <div className="flex justify-start">
          <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm shadow-sm px-4 py-3">
            <span className="flex gap-1 items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
