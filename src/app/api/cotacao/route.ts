import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbol=USDTBRL',
      { cache: 'no-store' },
    )
    if (!res.ok) throw new Error('upstream error')
    const data = await res.json()
    return NextResponse.json({
      rate: parseFloat(data.lastPrice),
      pctChange: parseFloat(data.priceChangePercent),
    })
  } catch {
    return NextResponse.json({ error: 'Falha ao obter cotação' }, { status: 500 })
  }
}
