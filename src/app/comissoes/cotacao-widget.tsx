'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useExchangeRate } from '@/hooks/use-exchange-rate'

export default function CotacaoWidget() {
  const { rate, pctChange, loading, error, lastUpdated, refresh } = useExchangeRate()
  const [hoje, setHoje] = useState<Date | null>(null)

  useEffect(() => {
    setHoje(new Date())
    const agora = new Date()
    const msMeiaNoite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1).getTime() - agora.getTime()
    const timer = setTimeout(() => setHoje(new Date()), msMeiaNoite)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="inline-flex items-center gap-4 text-sm">
      {hoje && (
        <span className="text-muted-foreground tabular-nums">
          {format(hoje, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </span>
      )}

      <div className="h-4 w-px bg-border" />

      <div className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-2">
      <span className="font-medium text-muted-foreground">USD/BRL</span>

      {loading && !rate ? (
        <span className="text-xs text-muted-foreground">Carregando...</span>
      ) : error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-foreground">
            R$ {rate?.toFixed(4)}
          </span>
          {pctChange !== null && (
            <span className={`text-xs font-medium ${pctChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {pctChange >= 0 ? '▲' : '▼'} {Math.abs(pctChange).toFixed(2)}%
            </span>
          )}
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {format(lastUpdated, 'HH:mm:ss')}
            </span>
          )}
        </>
      )}

      <button
        onClick={refresh}
        title="Atualizar cotação"
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
      </button>
      </div>
    </div>
  )
}
