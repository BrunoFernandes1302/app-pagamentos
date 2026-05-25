'use client'

import { useState, useTransition } from 'react'
import { X, Loader2, ChevronsRight, Banknote, CheckCircle2, Pencil, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { pagarParcela, adiantarParcela, pagamentoAvulso, atualizarMesParcela } from './actions'
import type { Emprestimo, ParcelaEmprestimo, StatusParcela } from '@/lib/types'

const STATUS: Record<StatusParcela, { label: string; cls: string }> = {
  pendente:      { label: 'Pendente',    cls: 'bg-amber-500/15 text-amber-400' },
  paga:          { label: 'Paga',        cls: 'bg-emerald-500/100/15 text-emerald-400' },
  adiantada:     { label: 'Adiantada',   cls: 'bg-blue-100 text-blue-700' },
  quitada_avulso:{ label: 'Quitada',     cls: 'bg-purple-100 text-purple-700' },
}

function fmtValor(valor: number, moeda: string) {
  return moeda === 'BRL'
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
    : `${valor.toFixed(2)} ${moeda}`
}

interface Props {
  emprestimo: Emprestimo
  onClose: () => void
  onUpdate: () => void
}

function MesEditor({
  parcelaId,
  mesReferencia,
  onSave,
}: {
  parcelaId: string
  mesReferencia: string
  onSave: (id: string, newDate: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(mesReferencia.substring(0, 7))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!value) return
    const newDate = `${value}-01`
    startTransition(async () => {
      await atualizarMesParcela(parcelaId, newDate)
      onSave(parcelaId, newDate)
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="month"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') { setValue(mesReferencia.substring(0, 7)); setEditing(false) }
          }}
          className="rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleSave}
          disabled={isPending || !value}
          className="rounded p-0.5 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
          title="Confirmar"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </button>
        <button
          onClick={() => { setValue(mesReferencia.substring(0, 7)); setEditing(false) }}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted transition-colors"
          title="Cancelar"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 group/mes">
      {format(parseISO(mesReferencia), 'MMMM/yyyy', { locale: ptBR })}
      <button
        onClick={() => setEditing(true)}
        className="rounded p-0.5 text-muted-foreground/40 opacity-0 group-hover/mes:opacity-100 hover:text-muted-foreground transition-all"
        title="Alterar mês"
      >
        <Pencil className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}

export default function ParcelasDialog({ emprestimo, onClose, onUpdate }: Props) {
  const [isPending, startTransition] = useTransition()
  const [avulsoOpen, setAvulsoOpen] = useState(false)
  const [qtdAvulso, setQtdAvulso] = useState(1)
  const [localParcelas, setLocalParcelas] = useState<ParcelaEmprestimo[]>(
    () => [...(emprestimo.parcelas_emprestimo ?? [])].sort((a, b) => a.numero_parcela - b.numero_parcela)
  )

  function handleMesSaved(id: string, newDate: string) {
    setLocalParcelas(prev => prev.map(p => p.id === id ? { ...p, mes_referencia: newDate } : p))
  }

  const parcelas = localParcelas
  const pendentes = parcelas.filter(p => p.status === 'pendente')
  const pagas = parcelas.filter(p => p.status !== 'pendente')
  const maxAvulso = pendentes.length

  const handlePagar = (p: ParcelaEmprestimo) => {
    startTransition(async () => {
      await pagarParcela(p.id, emprestimo.id)
      onUpdate()
    })
  }

  const handleAdiantar = () => {
    startTransition(async () => {
      await adiantarParcela(emprestimo.id)
      onUpdate()
    })
  }

  const handleAvulso = () => {
    startTransition(async () => {
      await pagamentoAvulso(emprestimo.id, qtdAvulso)
      setAvulsoOpen(false)
      onUpdate()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-lg flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Parcelas do Empréstimo</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {emprestimo.prestadores?.nome}
              {' · '}
              {fmtValor(emprestimo.valor_total, emprestimo.moeda)} em {emprestimo.numero_parcelas}x
              {emprestimo.observacoes && ` · ${emprestimo.observacoes}`}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted transition-colors mt-0.5">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Barra de ações */}
        {emprestimo.status === 'ativo' && (
          <div className="flex gap-2 px-6 py-3 border-b border-border shrink-0 flex-wrap">
            <button
              onClick={handleAdiantar}
              disabled={isPending || pendentes.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
              Adiantar próxima parcela
            </button>
            <button
              onClick={() => { setAvulsoOpen(v => !v); setQtdAvulso(1) }}
              disabled={pendentes.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Banknote className="h-3.5 w-3.5" />
              Pagamento avulso
            </button>
          </div>
        )}

        {/* Formulário de pagamento avulso */}
        {avulsoOpen && (
          <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/40 shrink-0 flex-wrap">
            <span className="text-sm text-foreground">Quitar as últimas</span>
            <input
              type="number"
              min={1}
              max={maxAvulso}
              value={qtdAvulso}
              onChange={e => setQtdAvulso(Math.min(maxAvulso, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">
              parcela(s) — {fmtValor(emprestimo.valor_parcela * qtdAvulso, emprestimo.moeda)}
            </span>
            <button
              onClick={handleAvulso}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar'}
            </button>
            <button onClick={() => setAvulsoOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
        )}

        {/* Lista de parcelas */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {parcelas.map(p => {
            const st = STATUS[p.status]
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground w-8 shrink-0 tabular-nums">
                  {p.numero_parcela}ª
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{fmtValor(p.valor, p.moeda)}</p>
                  <div className="text-xs text-muted-foreground">
                    {p.status === 'pendente' && emprestimo.status === 'ativo' ? (
                      <MesEditor
                        parcelaId={p.id}
                        mesReferencia={p.mes_referencia}
                        onSave={handleMesSaved}
                      />
                    ) : (
                      format(parseISO(p.mes_referencia), 'MMMM/yyyy', { locale: ptBR })
                    )}
                    {p.data_pagamento && (
                      <span> · pago em {format(parseISO(p.data_pagamento), 'dd/MM/yyyy')}</span>
                    )}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${st.cls}`}>
                  {st.label}
                </span>
                {p.status === 'pendente' && emprestimo.status === 'ativo' && (
                  <button
                    onClick={() => handlePagar(p)}
                    disabled={isPending}
                    title="Marcar como paga"
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40 shrink-0"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Pagar
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Rodapé com resumo */}
        <div className="border-t border-border px-6 py-3 shrink-0 flex items-center gap-6 text-xs text-muted-foreground">
          <span>{pagas.length}/{parcelas.length} pagas</span>
          {pendentes.length > 0 && (
            <span>Restante: {fmtValor(emprestimo.valor_parcela * pendentes.length, emprestimo.moeda)}</span>
          )}
          {emprestimo.status === 'quitado' && (
            <span className="text-emerald-400 font-medium">Empréstimo quitado</span>
          )}
        </div>
      </div>
    </div>
  )
}
