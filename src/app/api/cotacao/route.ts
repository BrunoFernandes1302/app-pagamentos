import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Fonte 1: Binance — USDT/BRL real-time, global, sem API key
async function fetchBinance(): Promise<{ rate: number; pctChange: number }> {
  const res = await fetch(
    'https://api.binance.com/api/v3/ticker/24hr?symbol=USDTBRL',
    { cache: 'no-store', signal: AbortSignal.timeout(5000) },
  )
  if (!res.ok) throw new Error('binance error')
  const data = await res.json()
  if (!data.lastPrice) throw new Error('invalid response')
  return {
    rate: parseFloat(data.lastPrice),
    pctChange: parseFloat(data.priceChangePercent ?? '0'),
  }
}

// Fonte 2: AwesomeAPI — USD/BRL ask, funciona no Brasil
async function fetchAwesome(): Promise<{ rate: number; pctChange: number }> {
  const res = await fetch(
    'https://economia.awesomeapi.com.br/json/last/USD-BRL',
    { cache: 'no-store', signal: AbortSignal.timeout(5000) },
  )
  if (!res.ok) throw new Error('awesome error')
  const data = await res.json()
  const q = data.USDBRL
  if (!q?.ask) throw new Error('invalid response')
  return { rate: parseFloat(q.ask), pctChange: parseFloat(q.pctChange ?? '0') }
}

// Fonte 3: open.er-api — cotação diária, último recurso
async function fetchOpenER(): Promise<{ rate: number; pctChange: number }> {
  const res = await fetch(
    'https://open.er-api.com/v6/latest/USD',
    { cache: 'no-store', signal: AbortSignal.timeout(5000) },
  )
  if (!res.ok) throw new Error('opener error')
  const data = await res.json()
  if (data.result !== 'success' || !data.rates?.BRL) throw new Error('invalid response')
  return { rate: data.rates.BRL, pctChange: 0 }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(null, { status: 401 })

  for (const source of [fetchBinance, fetchAwesome, fetchOpenER]) {
    try {
      return NextResponse.json(await source())
    } catch {
      // tenta próxima fonte
    }
  }

  return NextResponse.json({ error: 'Falha ao obter cotação' }, { status: 500 })
}
