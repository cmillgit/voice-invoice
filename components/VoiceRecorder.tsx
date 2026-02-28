'use client'

import { useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

interface VoiceRecorderProps {
  onTranscriptReady: (transcript: string) => void
  disabled?: boolean
}

function getAudioMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return ''
}

export default function VoiceRecorder({ onTranscriptReady, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  async function startRecording() {
    if (disabled || isProcessing) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = getAudioMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        chunksRef.current = []

        if (blob.size === 0) return

        setIsProcessing(true)
        try {
          const formData = new FormData()
          formData.append('audio', blob, `recording.${mimeType?.includes('mp4') ? 'mp4' : 'webm'}`)

          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const data = await res.json()

          if (!res.ok) throw new Error(data.error ?? 'Transcription failed')
          if (data.transcript?.trim()) {
            onTranscriptReady(data.transcript)
          }
        } catch (err) {
          console.error('[VoiceRecorder] transcribe error:', err)
          onTranscriptReady('') // signal error back to parent
        } finally {
          setIsProcessing(false)
        }
      }

      recorder.start()
      setIsRecording(true)
      setPermissionDenied(false)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPermissionDenied(true)
      }
      console.error('[VoiceRecorder] getUserMedia error:', err)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const isActive = isRecording || isProcessing

  return (
    <div className="flex flex-col items-center gap-2">
      {permissionDenied && (
        <p className="text-xs text-red-500 text-center max-w-[160px]">
          Microphone access denied. Please allow it in your browser settings.
        </p>
      )}

      <div className="relative">
        {/* Pulsing ring while recording */}
        {isRecording && (
          <span className="absolute inset-0 rounded-full bg-blue-400 opacity-40 animate-ping" />
        )}

        <button
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg
            touch-none select-none transition-colors
            ${isRecording ? 'bg-red-500 active:bg-red-700' : 'bg-blue-600 active:bg-blue-800'}
            ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerCancel={stopRecording}
          disabled={disabled || isProcessing}
        >
          {isProcessing ? (
            <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>
      </div>

      <p className="text-xs text-gray-500 select-none">
        {isProcessing ? 'Processing…' : isRecording ? 'Release to send' : 'Hold to speak'}
      </p>
    </div>
  )
}
