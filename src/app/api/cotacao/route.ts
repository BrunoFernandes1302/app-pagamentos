import { NextResponse } from 'next/server'

export async function GET() {
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
