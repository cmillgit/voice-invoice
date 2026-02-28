import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/whisper'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 400 })
    }

    const transcript = await transcribeAudio(audioFile)
    return NextResponse.json({ transcript })
  } catch (err) {
    console.error('[transcribe]', err)
    return NextResponse.json(
      { error: 'Transcription failed. Check your OpenAI API key and try again.' },
      { status: 500 }
    )
  }
}
