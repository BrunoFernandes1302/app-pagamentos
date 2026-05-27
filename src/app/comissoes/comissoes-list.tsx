'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Loader2, Percent, Wallet, QrCode, CheckCircle2, Copy, Check, ArrowDownAZ, CalendarDays, FileCheck2, Repeat, Layers, XCircle, PlayCircle, ChevronDown, ChevronRight } from 'lucide-react'
import type { Comissao, PrestadorResumido, MoedaSimples, TipoChavePix } from '@/lib/types'
import { TIPO_PIX_LABEL } from '@/lib/types'
import { useExchangeRate } from '@/hooks/use-exchange-rate'
import { excluirComissao, atualizarNotaFiscalComissao, encerrarRecorrencia, gerarInstanciaAgora } from './actions'
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

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  const ano = iso.substring(0, 4)
  return `${d}/${m}/${ano}`
}

const SEM_PREVISAO = 'sem_previsao'

function getMesKey(c: Comissao) {
  return c.previsao_pagamento ? c.previsao_pagamento.substring(0, 7) : SEM_PREVISAO
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
  if (moedaVenda !== 'BRL' && moedaRecebimento !== 'BRL') return base
  if (!rate) return null
  return moedaVenda === 'BRL' ? base / rate : base * rate
}

function formatValor(value: number | null, moeda: MoedaSimples) {
  if (value === null) return <span className="text-amber-400 text-xs">aguardando cotação</span>
  if (moeda !== 'BRL')
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${moeda}`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatReceita(value: number, moeda: string) {
  if (moeda !== 'BRL')
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${moeda}`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

type StatusFiltro = 'todas' | 'pendentes' | 'pagas'
type Ordenacao = 'data' | 'alfabetica'

// ─── Template card (recorrente) ────────────────────────────────────────────

function TemplateCard({
  template,
  hasPendingInstance,
  onEdit,
  rate,
}: {
  template: Comissao
  hasPendingInstance: boolean
  onEdit: (c: Comissao) => void
  rate: number | null
}) {
  const [encerrandoId, setEncerrandoId] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [, startTransition] = useTransition()

  function handleEncerrar(id: string) {
    if (encerrandoId === id) {
      startTransition(async () => {
        await encerrarRecorrencia(id)
        setEncerrandoId(null)
      })
    } else {
      setEncerrandoId(id)
    }
  }

  function handleGerarInstancia() {
    setGerando(true)
    startTransition(async () => {
      try {
        await gerarInstanciaAgora(template.id)
      } finally {
        setGerando(false)
      }
    })
  }

  const nomesPrestadores = template.comissao_prestadores
    .map(cp => cp.prestadores?.nome ?? '(removido)')
    .join(' · ')

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header do template */}
      <div className="flex items-start gap-4 px-5 py-3.5 border-b border-border">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-400">
              <Repeat className="h-3 w-3" />
              Recorrente
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {template.tipo}
            </span>
            {template.proxima_recorrencia && (
              <span className="text-xs text-muted-foreground">
                Próxima geração: <span className="font-medium text-foreground">{fmtDate(template.proxima_recorrencia)}</span>
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">{nomesPrestadores}</p>
          <p className="text-xs text-muted-foreground">{template.descricao}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(template)}
            title="Editar"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {encerrandoId === template.id ? (
            <>
              <button
                onClick={() => handleEncerrar(template.id)}
                className="rounded px-2 py-1 text-xs font-medium text-white bg-destructive hover:bg-destructive/80 transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={() => setEncerrandoId(null)}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => handleEncerrar(template.id)}
              title="Encerrar recorrência"
              className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-destructive transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Encerrar
            </button>
          )}
        </div>
      </div>

      {/* Ação de pagamento */}
      <div className="px-5 py-3 bg-muted/30 flex items-center justify-between gap-4">
        {hasPendingInstance ? (
          <p className="text-xs text-muted-foreground">
            Há uma ocorrência pendente de pagamento na lista abaixo.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma ocorrência pendente. Gere uma para registrar o pagamento.
          </p>
        )}
        {!hasPendingInstance && (
          <button
            onClick={handleGerarInstancia}
            disabled={gerando}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors disabled:opacity-50 shrink-0"
          >
            {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            Gerar pagamento
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

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
  const [, startNfTransition] = useTransition()
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [nfState, setNfState] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const c of comissoes) {
      for (const cp of c.comissao_prestadores) {
        map[cp.id] = cp.nota_fiscal
      }
    }
    return map
  })

  function copiar(id: string, valor: string) {
    navigator.clipboard.writeText(valor)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 2000)
  }
  const { rate } = useExchangeRate()

  // Separar templates de comissões normais
  const templates = useMemo(() =>
    comissoes.filter(c => c.recorrente === true && c.recorrencia_ativa !== false),
    [comissoes]
  )

  const normais = useMemo(() =>
    comissoes.filter(c => !c.recorrente),
    [comissoes]
  )

  // Templates que já têm instância pendente de pagamento
  const templatesComPendente = useMemo(() => {
    const set = new Set<string>()
    for (const c of normais) {
      if (c.recorrencia_origem_id && c.comissao_prestadores.some(cp => !cp.pago)) {
        set.add(c.recorrencia_origem_id)
      }
    }
    return set
  }, [normais])

  // Filtros
  const [recorrenciasVisiveis, setRecorrenciasVisiveis] = useState(false)
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('pendentes')
  const [prestadorFiltro, setPrestadorFiltro] = useState('')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('data')

  const prestadoresFiltro = useMemo(() => {
    const map = new Map<string, string>()
    normais.forEach(c =>
      c.comissao_prestadores.forEach(cp => {
        if (cp.prestadores) map.set(cp.prestador_id, cp.prestadores.nome)
      })
    )
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [normais])

  const comissoesFiltradas = useMemo(() => {
    return normais
      .filter(c => {
        if (statusFiltro === 'pagas') return c.comissao_prestadores.every(cp => cp.pago)
        if (statusFiltro === 'pendentes') return c.comissao_prestadores.some(cp => !cp.pago)
        return true
      })
      .filter(c =>
        !prestadorFiltro || c.comissao_prestadores.some(cp => cp.prestador_id === prestadorFiltro)
      )
  }, [normais, statusFiltro, prestadorFiltro])

  const grupos = useMemo(() => {
    const map = new Map<string, Comissao[]>()
    for (const c of comissoesFiltradas) {
      const key = getMesKey(c)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    for (const [, items] of map) {
      if (ordenacao === 'alfabetica') {
        items.sort((a, b) => {
          const nameA = [...a.comissao_prestadores]
            .map(cp => cp.prestadores?.nome ?? '')
            .sort((x, y) => x.localeCompare(y, 'pt-BR'))[0] ?? ''
          const nameB = [...b.comissao_prestadores]
            .map(cp => cp.prestadores?.nome ?? '')
            .sort((x, y) => x.localeCompare(y, 'pt-BR'))[0] ?? ''
          return nameA.localeCompare(nameB, 'pt-BR')
        })
      } else {
        items.sort((a, b) => {
          const da = a.previsao_pagamento ?? a.created_at
          const db = b.previsao_pagamento ?? b.created_at
          return da.localeCompare(db)
        })
      }
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === SEM_PREVISAO) return 1
      if (b[0] === SEM_PREVISAO) return -1
      return a[0].localeCompare(b[0])
    })
  }, [comissoesFiltradas, ordenacao])

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

      {/* Recorrências ativas */}
      {templates.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setRecorrenciasVisiveis(v => !v)}
            className="w-full flex items-center gap-3 mb-3 group"
          >
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Repeat className="h-4 w-4 text-violet-400" />
              Recorrências ativas
            </h2>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{templates.length} {templates.length === 1 ? 'template' : 'templates'}</span>
            {recorrenciasVisiveis
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {recorrenciasVisiveis && (
            <div className="space-y-2">
              {templates.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  hasPendingInstance={templatesComPendente.has(t.id)}
                  onEdit={openEdit}
                  rate={rate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      {normais.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
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

          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setOrdenacao('data')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                ordenacao === 'data'
                  ? 'bg-foreground text-background'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Por data
            </button>
            <button
              onClick={() => setOrdenacao('alfabetica')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                ordenacao === 'alfabetica'
                  ? 'bg-foreground text-background'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" />
              A→Z
            </button>
          </div>

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

          {(statusFiltro !== 'todas' || prestadorFiltro) && (
            <span className="text-xs text-muted-foreground">
              {comissoesFiltradas.length} de {normais.length}
            </span>
          )}
        </div>
      )}

      {normais.length === 0 && templates.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <Percent className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma comissão registrada.</p>
        </div>
      ) : normais.length > 0 && comissoesFiltradas.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <Percent className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma comissão encontrada com esses filtros.</p>
        </div>
      ) : normais.length > 0 ? (
        <div className="space-y-8">
          {grupos.map(([mesKey, itens]) => (
            <div key={mesKey}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  {mesKey === SEM_PREVISAO ? 'Sem previsão de pagamento' : formatMesPeriodo(mesKey)}
                </h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{itens.length} {itens.length === 1 ? 'comissão' : 'comissões'}</span>
              </div>
              <div className="space-y-3">
          {itens.map((c) => {
            const isDeleting = deletingId === c.id
            const todosPageos = c.comissao_prestadores.every(cp => cp.pago)
            const isParcelada = c.parcela_num !== null && c.total_parcelas !== null
            const isRecorrenteInstance = !!c.recorrencia_origem_id

            return (
              <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden">

                {/* Cabeçalho */}
                <div className="flex items-start justify-between px-5 py-3 border-b border-border gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-foreground leading-snug">
                      {c.comissao_prestadores.map(cp => cp.prestadores?.nome ?? '(Prestador removido)').join(' · ')}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {c.tipo}
                      </span>
                      {isParcelada && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
                          <Layers className="h-3 w-3" />
                          Parcela {c.parcela_num}/{c.total_parcelas}
                        </span>
                      )}
                      {isRecorrenteInstance && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-400">
                          <Repeat className="h-3 w-3" />
                          Recorrente
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.moeda_venda !== 'BRL' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                      }`}>
                        Receita: {formatReceita(c.receita_ether, c.moeda_venda)}
                      </span>
                      {todosPageos && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Pago
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
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
                        className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Prestadores — detalhes de pagamento */}
                <div className="divide-y divide-border">
                  {c.comissao_prestadores.map((cp) => {
                    const valorAtual = calcularComissao(
                      c.receita_ether,
                      cp.percentual,
                      c.moeda_venda,
                      cp.moeda_recebimento,
                      rate,
                    )
                    const info =
                      cp.moeda_recebimento === 'BRL'
                        ? { val: cp.prestadores?.chave_pix ?? null, rede: null, pixTipo: cp.prestadores?.tipo_chave_pix ?? null }
                        : { val: cp.prestadores?.carteira_cripto ?? null, rede: cp.prestadores?.rede_cripto ?? null, pixTipo: null }

                    return (
                      <div key={cp.id} className="px-5 py-2.5 flex items-center gap-4 justify-between">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                          {c.comissao_prestadores.length > 1 && (
                            <span className="text-sm font-semibold text-foreground">
                              {cp.prestadores?.nome ?? '(Prestador removido)'}
                            </span>
                          )}
                          <span className="text-sm text-muted-foreground">
                            Comissão: <span className="font-medium text-foreground">{cp.percentual}%</span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            A pagar:{' '}
                            <span className="font-semibold text-foreground">
                              {cp.pago
                                ? formatValor(cp.valor_comissao, cp.moeda_recebimento)
                                : formatValor(valorAtual, cp.moeda_recebimento)}
                            </span>
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {c.previsao_pagamento && (
                            <span className="text-xs text-muted-foreground">
                              Venc.: {fmtDate(c.previsao_pagamento)}
                            </span>
                          )}
                          {info.val ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {cp.moeda_recebimento === 'BRL'
                                ? <QrCode className="h-3.5 w-3.5 shrink-0" />
                                : <Wallet className="h-3.5 w-3.5 shrink-0" />}
                              <span className="font-mono">{info.val}</span>
                              {info.rede && (
                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-sans">{info.rede}</span>
                              )}
                              {info.pixTipo && (
                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-sans">
                                  {TIPO_PIX_LABEL[info.pixTipo as TipoChavePix] ?? info.pixTipo}
                                </span>
                              )}
                              <button
                                onClick={() => copiar(cp.id, info.val!)}
                                title="Copiar"
                                className="shrink-0 rounded p-0.5 hover:bg-muted transition-colors"
                              >
                                {copiadoId === cp.id
                                  ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-400">
                              Dados de pagamento em {cp.moeda_recebimento} não cadastrados.
                            </span>
                          )}
                          {cp.pago ? (
                            nfState[cp.id]
                              ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><FileCheck2 className="h-3.5 w-3.5" />NF</span>
                              : null
                          ) : (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                              <input
                                type="checkbox"
                                checked={nfState[cp.id] ?? false}
                                title="Nota fiscal enviada"
                                onChange={(e) => {
                                  const v = e.target.checked
                                  setNfState(prev => ({ ...prev, [cp.id]: v }))
                                  startNfTransition(() => atualizarNotaFiscalComissao(cp.id, v))
                                }}
                                className="h-3.5 w-3.5 cursor-pointer accent-emerald-500"
                              />
                              NF
                            </label>
                          )}

                          {cp.pago ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              Pago
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
                                notaFiscal: nfState[cp.id] ?? false,
                                defaultMes: c.previsao_pagamento
                                  ? c.previsao_pagamento.substring(0, 7)
                                  : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                              })}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors"
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
            </div>
          ))}
        </div>
      ) : null}

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
