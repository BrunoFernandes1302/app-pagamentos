import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(null, { status: 401 })

  try {
    const res = await fetch(
      'https://economia.awesomeapi.com.br/json/last/USD-BRL',
      { cache: 'no-store' },
    )
    if (!res.ok) throw new Error('upstream error')
    const data = await res.json()
    const quote = data.USDBRL
    return NextResponse.json({
      rate: parseFloat(quote.ask),
      pctChange: parseFloat(quote.pctChange),
    })
  } catch {
    return NextResponse.json({ error: 'Falha ao obter cotação' }, { status: 500 })
  }
}
