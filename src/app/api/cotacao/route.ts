import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    if (!res.ok) throw new Error('upstream error')
    const data = await res.json()
    return NextResponse.json({
      rate: parseFloat(data.USDBRL.bid),
      pctChange: parseFloat(data.USDBRL.pctChange),
    })
  } catch {
    return NextResponse.json({ error: 'Falha ao obter cotação' }, { status: 500 })
  }
}
