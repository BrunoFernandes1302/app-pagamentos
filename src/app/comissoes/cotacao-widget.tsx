'use client'

import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { useExchangeRate } from '@/hooks/use-exchange-rate'

export default function CotacaoWidget() {
  const { rate, pctChange, loading, error, lastUpdated, refresh } = useExchangeRate()

  return (
    <div className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-2 text-sm">
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
  )
}
