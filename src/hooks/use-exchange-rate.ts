'use client'

import { useState, useEffect, useCallback } from 'react'

export interface CotacaoState {
  rate: number | null
  pctChange: number | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useExchangeRate() {
  const [state, setState] = useState<CotacaoState>({
    rate: null,
    pctChange: null,
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const fetchRate = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch('/api/cotacao')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setState({
        rate: data.rate,
        pctChange: data.pctChange,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch {
      setState(prev => ({ ...prev, loading: false, error: 'Falha ao obter cotação' }))
    }
  }, [])

  useEffect(() => {
    fetchRate()
    const id = setInterval(fetchRate, 60_000)
    return () => clearInterval(id)
  }, [fetchRate])

  return { ...state, refresh: fetchRate }
}
