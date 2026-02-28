import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[clients GET]', err)
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('clients')
      .insert(body)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[clients POST]', err)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
