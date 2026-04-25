'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Loader2, Percent, Wallet, QrCode, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Comissao, PrestadorResumido, MoedaSimples } from '@/lib/types'
import { useExchangeRate } from '@/hooks/use-exchange-rate'
import { excluirComissao } from './actions'
import ComissaoFormDialog from './comissao-form-dialog'
import RegistrarPagamentoDialog, { type PagamentoContext } from './registrar-pagamento-dialog'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatMesPeriodo(yyyyMm: string) {
  const [ano, mes] = yyyyMm.split('-').map(Number)
  return `${MESES[mes - 1]} ${ano}`
}

function calcularComissao(
  receita: number,
  percentual: number,
  moedaVenda: MoedaSimples,
  moedaRecebimento: MoedaSimples,
  rate: number | null,
): number | null {
  const base = receita * percentual / 100
  if (moedaVenda === moedaRecebimento) return base
  if (!rate) return null
  return moedaVenda === 'BRL' ? base / rate : base * rate
}

function formatValor(value: number | null, moeda: MoedaSimples) {
  if (value === null) return <span className="text-amber-600 text-xs">aguardando cotação</span>
  if (moeda === 'USDT')
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatReceita(value: number, moeda: string) {
  if (moeda === 'USDT')
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} USDT`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

type StatusFiltro = 'todas' | 'pendentes' | 'pagas'

export default function ComissoesList({
  comissoes,
  prestadoresAtivos,
}: {
  comissoes: Comissao[]
  prestadoresAtivos: PrestadorResumido[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingComissao, setEditingComissao] = useState<Comissao | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pagamentoContext, setPagamentoContext] = useState<PagamentoContext | null>(null)
  const [isPending, startTransition] = useTransition()
  const { rate } = useExchangeRate()

  // Filtros
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('pendentes')
  const [prestadorFiltro, setPrestadorFiltro] = useState('')
  const [periodoFiltro, setPeriodoFiltro] = useState('')

  const prestadoresFiltro = useMemo(() => {
    const map = new Map<string, string>()
    comissoes.forEach(c =>
      c.comissao_prestadores.forEach(cp => {
        if (cp.prestadores) map.set(cp.prestador_id, cp.prestadores.nome)
      })
    )
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [comissoes])

  const periodos = useMemo(() => {
    const set = new Set<string>()
    comissoes.forEach(c => set.add(c.created_at.substring(0, 7)))
    return Array.from(set).sort().reverse()
  }, [comissoes])

  const comissoesFiltradas = useMemo(() => {
    return comissoes
      .filter(c => {
        if (statusFiltro === 'pagas') return c.comissao_prestadores.every(cp => cp.pago)
        if (statusFiltro === 'pendentes') return c.comissao_prestadores.some(cp => !cp.pago)
        return true
      })
      .filter(c =>
        !prestadorFiltro || c.comissao_prestadores.some(cp => cp.prestador_id === prestadorFiltro)
      )
      .filter(c =>
        !periodoFiltro || c.created_at.startsWith(periodoFiltro)
      )
  }, [comissoes, statusFiltro, prestadorFiltro, periodoFiltro])

  function openCreate() {
    setEditingComissao(null)
    setDialogOpen(true)
  }

  function openEdit(comissao: Comissao) {
    setEditingComissao(comissao)
    setDialogOpen(true)
  }

  function handleDeleteClick(id: string) {
    if (deletingId === id) {
      startTransition(async () => {
        await excluirComissao(id)
        setDeletingId(null)
      })
    } else {
      setDeletingId(id)
    }
  }

  const selectClass =
    'rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
        >
          <Plus className="h-4 w-4" />
          Registrar Comissão
        </button>
      </div>

      {/* Filtros */}
      {comissoes.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {/* Status */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['todas', 'pendentes', 'pagas'] as StatusFiltro[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFiltro(s)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  statusFiltro === s
                    ? 'bg-foreground text-background'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {s === 'todas' ? 'Todas' : s === 'pendentes' ? 'Pendentes' : 'Pagas'}
              </button>
            ))}
          </div>

          {/* Prestador */}
          {prestadoresFiltro.length > 1 && (
            <select
              value={prestadorFiltro}
              onChange={e => setPrestadorFiltro(e.target.value)}
              className={selectClass}
            >
              <option value="">Todos os prestadores</option>
              {prestadoresFiltro.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          )}

          {/* Período */}
          {periodos.length > 1 && (
            <select
              value={periodoFiltro}
              onChange={e => setPeriodoFiltro(e.target.value)}
              className={selectClass}
            >
              <option value="">Todos os períodos</option>
              {periodos.map(p => (
                <option key={p} value={p}>{formatMesPeriodo(p)}</option>
              ))}
            </select>
          )}

          {/* Contador */}
          {(statusFiltro !== 'todas' || prestadorFiltro || periodoFiltro) && (
            <span className="text-xs text-muted-foreground">
              {comissoesFiltradas.length} de {comissoes.length}
            </span>
          )}
        </div>
      )}

      {comissoes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <Percent className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma comissão registrada.</p>
        </div>
      ) : comissoesFiltradas.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <Percent className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma comissão encontrada com esses filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comissoesFiltradas.map((c) => {
            const isDeleting = deletingId === c.id
            const todosPageos = c.comissao_prestadores.every(cp => cp.pago)

            return (
              <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden">

                {/* Cabeçalho */}
                <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-foreground">{c.tipo}</span>
                    <span className="text-xs text-muted-foreground">
                      Registrada: {format(new Date(c.created_at), 'dd/MM/yyyy')}
                    </span>
                    {c.previsao_pagamento && (
                      <span className="text-xs text-muted-foreground">
                        Prev. pag.: {(() => {
                          const [a, m, d] = c.previsao_pagamento.split('-')
                          return `${d}/${m}/${a}`
                        })()}
                      </span>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.moeda_venda === 'USDT'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      Receita: {formatReceita(c.receita_ether, c.moeda_venda)}
                    </span>
                    {todosPageos && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        Pago
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <button
                      onClick={() => openEdit(c)}
                      title="Editar"
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    {isDeleting ? (
                      <>
                        <button
                          onClick={() => handleDeleteClick(c.id)}
                          disabled={isPending}
                          className="rounded px-2 py-1 text-xs font-medium text-white bg-destructive hover:bg-destructive/80 transition-colors disabled:opacity-50"
                        >
                          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleDeleteClick(c.id)}
                        title="Excluir"
                        className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Descrição */}
                <div className="px-5 py-3 text-sm text-muted-foreground border-b border-border">
                  {c.descricao}
                </div>

                {/* Prestadores */}
                <div className="divide-y divide-border">
                  {c.comissao_prestadores.map((cp) => {
                    const valorAtual = calcularComissao(
                      c.receita_ether,
                      cp.percentual,
                      c.moeda_venda,
                      cp.moeda_recebimento,
                      rate,
                    )
                    const precisaConversao = c.moeda_venda !== cp.moeda_recebimento
                    const info =
                      cp.moeda_recebimento === 'BRL'
                        ? { val: cp.prestadores?.chave_pix ?? null, rede: null }
                        : { val: cp.prestadores?.carteira_cripto ?? null, rede: cp.prestadores?.rede_cripto ?? null }

                    return (
                      <div key={cp.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="font-medium text-sm text-foreground">
                            {cp.prestadores?.nome ?? '(Prestador removido)'}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {cp.percentual}% da receita{' → '}
                            {cp.pago ? (
                              <span className="font-semibold text-foreground">
                                {formatValor(cp.valor_comissao, cp.moeda_recebimento)}
                              </span>
                            ) : (
                              <span className="font-semibold text-foreground">
                                {formatValor(valorAtual, cp.moeda_recebimento)}
                              </span>
                            )}
                            {!cp.pago && precisaConversao && rate && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                (R$ {rate.toFixed(4)}/USD)
                              </span>
                            )}
                          </span>
                        </div>

                        {info.val ? (
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            {cp.moeda_recebimento === 'BRL' ? (
                              <QrCode className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Wallet className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="font-mono break-all">{info.val}</span>
                            {info.rede && (
                              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-sans">
                                {info.rede}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-amber-600">
                            Dados de pagamento em {cp.moeda_recebimento} não cadastrados.
                          </p>
                        )}

                        {/* Botão / badge de pagamento */}
                        <div className="mt-3">
                          {cp.pago ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              Pagamento registrado
                            </span>
                          ) : (
                            <button
                              onClick={() => setPagamentoContext({
                                cpId: cp.id,
                                comissaoId: c.id,
                                comissaoTipo: c.tipo,
                                comissaoDescricao: c.descricao,
                                prestadorId: cp.prestador_id,
                                prestadorNome: cp.prestadores?.nome ?? '(Prestador removido)',
                                moeda: cp.moeda_recebimento,
                                carteiraCripto: cp.prestadores?.carteira_cripto ?? null,
                                redeCripto: cp.prestadores?.rede_cripto ?? null,
                                chavePix: cp.prestadores?.chave_pix ?? null,
                                valorSugerido: valorAtual,
                                rate,
                                defaultMes: c.previsao_pagamento
                                  ? c.previsao_pagamento.substring(0, 7)
                                  : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                              })}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                            >
                              Registrar Pagamento
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ComissaoFormDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        prestadoresAtivos={prestadoresAtivos}
        comissao={editingComissao}
      />

      <RegistrarPagamentoDialog
        context={pagamentoContext}
        onClose={() => setPagamentoContext(null)}
      />
    </>
  )
}
