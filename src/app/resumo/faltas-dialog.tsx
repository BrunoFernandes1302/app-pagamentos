'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { X, Trash2, Loader2, Plus } from 'lucide-react'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { registrarFalta, registrarFaltasPeriodo, excluirFalta } from './falta-actions'

export interface FaltaItem {
  id: string
  prestador_id: string
  data: string
  motivo: string | null
}

interface Props {
  isOpen: boolean
  onClose: (updated: boolean) => void
  prestadorId: string
  prestadorNome: string
  mesAtual: string // 'YYYY-MM-DD'
  faltas: FaltaItem[]
}

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

export default function FaltasDialog({ isOpen, onClose, prestadorId, prestadorNome, mesAtual, faltas }: Props) {
  const [localFaltas, setLocalFaltas] = useState<FaltaItem[]>([])
  const [novaData, setNovaData] = useState('')
  const [novaDataFim, setNovaDataFim] = useState('')
  const [novoMotivo, setNovoMotivo] = useState('')
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLocalFaltas([...faltas].sort((a, b) => a.data.localeCompare(b.data)))
      // Abre no mês que está sendo visualizado, não hoje
      setNovaData(mesAtual)
      setNovaDataFim('')
      setNovoMotivo('')
      setError(null)
      setHasChanges(false)
      setDeletingId(null)
    }
  }, [isOpen, faltas, mesAtual])

  const diasSelecionados = useMemo(() => {
    if (!novaData) return 0
    if (!novaDataFim || novaDataFim <= novaData) return 1
    try {
      return eachDayOfInterval({ start: parseISO(novaData), end: parseISO(novaDataFim) }).length
    } catch {
      return 1
    }
  }, [novaData, novaDataFim])

  if (!isOpen) return null

  const mesLabel = format(parseISO(mesAtual), "MMMM 'de' yyyy", { locale: ptBR })
  const mesPrefixo = mesAtual.substring(0, 7)
  const isRange = !!novaDataFim && novaDataFim > novaData

  function handleAdd() {
    if (!novaData) return
    setError(null)
    const motivo = novoMotivo.trim() || null

    if (isRange) {
      // Registro de período — optimistic: adiciona todos os dias
      const datas = eachDayOfInterval({ start: parseISO(novaData), end: parseISO(novaDataFim) })
        .map(d => format(d, 'yyyy-MM-dd'))
      const tempBase = Date.now()
      const novasFaltas: FaltaItem[] = datas.map((d, i) => ({
        id: `tmp-${tempBase}-${i}`,
        prestador_id: prestadorId,
        data: d,
        motivo,
      }))
      setLocalFaltas(prev => [...prev, ...novasFaltas].sort((a, b) => a.data.localeCompare(b.data)))
      setHasChanges(true)
      setNovoMotivo('')
      setNovaDataFim('')
      startTransition(async () => {
        try {
          await registrarFaltasPeriodo({ prestador_id: prestadorId, dataInicio: novaData, dataFim: novaDataFim, motivo })
        } catch (e) {
          setLocalFaltas(prev => prev.filter(f => !f.id.startsWith(`tmp-${tempBase}`)))
          setHasChanges(false)
          setError(e instanceof Error ? e.message : 'Erro ao registrar.')
        }
      })
    } else {
      // Registro de dia único
      const tempId = `tmp-${Date.now()}`
      const nova: FaltaItem = { id: tempId, prestador_id: prestadorId, data: novaData, motivo }
      setLocalFaltas(prev => [...prev, nova].sort((a, b) => a.data.localeCompare(b.data)))
      setHasChanges(true)
      setNovoMotivo('')
      startTransition(async () => {
        try {
          await registrarFalta({ prestador_id: prestadorId, data: novaData, motivo })
        } catch (e) {
          setLocalFaltas(prev => prev.filter(f => f.id !== tempId))
          setHasChanges(false)
          setError(e instanceof Error ? e.message : 'Erro ao registrar.')
        }
      })
    }
  }

  function handleDelete(id: string) {
    if (deletingId !== id) { setDeletingId(id); return }
    const faltaRemovida = localFaltas.find(f => f.id === id)
    setLocalFaltas(prev => prev.filter(f => f.id !== id))
    setDeletingId(null)
    setHasChanges(true)
    startTransition(async () => {
      try {
        await excluirFalta(id)
      } catch {
        if (faltaRemovida) setLocalFaltas(prev => [...prev, faltaRemovida].sort((a, b) => a.data.localeCompare(b.data)))
        setHasChanges(false)
      }
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={() => onClose(hasChanges)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">{prestadorNome}</h2>
              <p className="text-xs text-muted-foreground capitalize">Faltas — {mesLabel}</p>
            </div>
            <button
              onClick={() => onClose(hasChanges)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">

            {/* Lista de faltas */}
            {localFaltas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                Nenhuma falta registrada.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {localFaltas.map(f => {
                  const isPending = f.id.startsWith('tmp-')
                  const outroMes = !f.data.startsWith(mesPrefixo)
                  return (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground tabular-nums">
                            {format(parseISO(f.data), 'dd/MM/yyyy')}
                          </p>
                          {outroMes && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400">
                              {format(parseISO(f.data), 'MMM/yy', { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        {f.motivo && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.motivo}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : deletingId === f.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(f.id)}
                              className="text-xs font-medium text-destructive"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="text-xs text-muted-foreground"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleDelete(f.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Form de adição */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Registrar falta</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">De</label>
                  <input
                    type="date"
                    value={novaData}
                    onChange={e => {
                      setNovaData(e.target.value)
                      // Se data fim ficou antes da início, limpa
                      if (novaDataFim && novaDataFim < e.target.value) setNovaDataFim('')
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    Até
                    <span className="ml-1 text-muted-foreground/60">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={novaDataFim}
                    min={novaData || undefined}
                    onChange={e => setNovaDataFim(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Contador de dias selecionados */}
              {diasSelecionados > 1 && (
                <p className="text-xs text-foreground font-medium">
                  {diasSelecionados} dias selecionados
                </p>
              )}

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Motivo (opcional)</label>
                <input
                  type="text"
                  value={novoMotivo}
                  onChange={e => setNovoMotivo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="Ex: Atestado médico, viagem..."
                  className={inputClass}
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <button
                onClick={handleAdd}
                disabled={!novaData || isPending}
                className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/80 disabled:opacity-50 transition-colors"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isRange ? `Registrar ${diasSelecionados} faltas` : 'Registrar falta'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
