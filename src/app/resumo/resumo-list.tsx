'use client'

import { Fragment, useState, useMemo, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Wallet, QrCode, Receipt, Copy, Check, CheckCircle2, FileCheck2, ChevronDown, ChevronRight } from 'lucide-react'
import { useExchangeRate } from '@/hooks/use-exchange-rate'
import type { TipoContrato, MoedaSimples, TipoChavePix, CriptoMoeda } from '@/lib/types'
import { CONTRATO_LABEL } from '@/lib/types'
import { TIPO_PIX_LABEL } from '@/lib/types'
import { atualizarNotaFiscalSalario } from './actions'
import RegistrarPagamentoSalarioDialog, {
  type SalarioPagamentoContext,
  type ComissaoPendente,
  type ComissaoPagamento,
} from './registrar-pagamento-dialog'
import FaltasDialog, { type FaltaItem } from './faltas-dialog'

export type { ComissaoPendente }

interface Parcela {
  id: string
  valor: number
  moeda: string
}

interface Item {
  id: string
  nome: string
  contrato: TipoContrato
  cripto_moeda: CriptoMoeda
  salario_base: number
  carteira_cripto: string | null
  rede_cripto: string | null
  chave_pix: string | null
  tipo_chave_pix: string | null
  parcelas: Parcela[]
}

interface Props {
  items: Item[]
  pagoIds: string[]
  mesAtual: string
  mesReferencia: string
  faltas: FaltaItem[]
  nfPendingMap: Record<string, boolean>
  nfPagoMap: Record<string, boolean>
  comissoesByPrestador: Map<string, ComissaoPendente[]>
}

const CONTRATO_BADGE: Record<TipoContrato, string> = {
  USDT:       'bg-emerald-500/100/15 text-emerald-300',
  'USDT/BRL': 'bg-blue-100 text-blue-800',
  BRL:        'bg-slate-500/10 text-slate-300',
}

function moedaBase(contrato: TipoContrato, cripto_moeda: CriptoMoeda): MoedaSimples {
  return contrato === 'USDT' ? cripto_moeda : 'BRL'
}

function moedaPagamento(contrato: TipoContrato, cripto_moeda: CriptoMoeda): MoedaSimples {
  return contrato === 'BRL' ? 'BRL' : cripto_moeda
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtCripto(v: number, cripto: CriptoMoeda) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${cripto}`
}

function fmt(v: number, moeda: MoedaSimples) {
  return moeda === 'BRL' ? fmtBRL(v) : fmtCripto(v, moeda as CriptoMoeda)
}

function truncar(s: string, n = 14) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function calcularValorComissao(
  receitaEther: number,
  percentual: number,
  moedaVenda: MoedaSimples,
  moedaRecebimento: MoedaSimples,
  rate: number | null,
): number | null {
  const base = receitaEther * percentual / 100
  if (moedaVenda === moedaRecebimento) return base
  if (moedaVenda !== 'BRL' && moedaRecebimento !== 'BRL') return base
  if (!rate) return null
  return moedaVenda === 'BRL' ? base / rate : base * rate
}

type Filtro = 'pendentes' | 'pagas'

export default function ResumoList({ items, pagoIds, mesAtual, mesReferencia, faltas, nfPendingMap, nfPagoMap, comissoesByPrestador }: Props) {
  const { rate } = useExchangeRate()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startNfTransition] = useTransition()
  const [nfState, setNfState] = useState<Record<string, boolean>>(nfPendingMap)

  const faltasByPrestador = useMemo(() => {
    const map = new Map<string, FaltaItem[]>()
    for (const f of faltas) {
      if (!map.has(f.prestador_id)) map.set(f.prestador_id, [])
      map.get(f.prestador_id)!.push(f)
    }
    return map
  }, [faltas])

  const [manualDias, setManualDias] = useState<Record<string, number>>({})

  const diasMap = useMemo(() =>
    Object.fromEntries(items.map(i => {
      const calculado = Math.max(1, 30 - (faltasByPrestador.get(i.id)?.length ?? 0))
      return [i.id, manualDias[i.id] ?? calculado]
    }))
  , [items, faltasByPrestador, manualDias])

  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('pendentes')
  const [pagamentoCtx, setPagamentoCtx] = useState<SalarioPagamentoContext | null>(null)
  const [faltaCtx, setFaltaCtx] = useState<{ prestadorId: string; prestadorNome: string } | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedByPrestador, setSelectedByPrestador] = useState<Record<string, string[]>>({})

  const pagoSet = new Set(pagoIds)

  function setDias(id: string, raw: string) {
    const v = parseInt(raw)
    if (isNaN(v)) return
    setManualDias(prev => ({ ...prev, [id]: Math.max(1, Math.min(30, v)) }))
  }

  function copiar(id: string, valor: string) {
    navigator.clipboard.writeText(valor)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  function toggleComissoes(prestadorId: string, comissoes: ComissaoPendente[]) {
    const willExpand = !expandedIds.has(prestadorId)
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(prestadorId)) next.delete(prestadorId)
      else next.add(prestadorId)
      return next
    })
    if (willExpand && selectedByPrestador[prestadorId] === undefined) {
      const cpIds = comissoes
        .filter(c => calcularValorComissao(c.receitaEther, c.percentual, c.moedaVenda, c.moeda, rate) !== null)
        .map(c => c.cpId)
      setSelectedByPrestador(prev => ({ ...prev, [prestadorId]: cpIds }))
    }
  }

  function toggleComissaoItem(prestadorId: string, cpId: string) {
    setSelectedByPrestador(prev => {
      const current = prev[prestadorId] ?? []
      const next = current.includes(cpId)
        ? current.filter(id => id !== cpId)
        : [...current, cpId]
      return { ...prev, [prestadorId]: next }
    })
  }

  function getComissoesSelecionadas(prestadorId: string, comissoes: ComissaoPendente[]): ComissaoPagamento[] {
    if (!expandedIds.has(prestadorId)) return []
    const selected = selectedByPrestador[prestadorId] ?? []
    const result: ComissaoPagamento[] = []
    for (const c of comissoes) {
      if (!selected.includes(c.cpId)) continue
      const valor = calcularValorComissao(c.receitaEther, c.percentual, c.moedaVenda, c.moeda, rate)
      if (valor === null) continue
      result.push({ cpId: c.cpId, comissaoId: c.comissaoId, tipo: c.tipo, descricao: c.descricao, valor, moeda: c.moeda, notaFiscal: c.notaFiscal })
    }
    return result
  }

  const defaultMes = mesAtual.substring(0, 7)

  const filteredItems = items.filter(item =>
    filtro === 'pendentes' ? !pagoSet.has(item.id) : pagoSet.has(item.id)
  )

  const totalPendentes = items.filter(i => !pagoSet.has(i.id)).length
  const totalPagas = items.filter(i => pagoSet.has(i.id)).length

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Receipt className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum prestador ativo cadastrado.</p>
      </div>
    )
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setFiltro('pendentes')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            filtro === 'pendentes'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Pendentes
          {totalPendentes > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-500/15 text-amber-400 px-1.5 py-0.5 text-xs">
              {totalPendentes}
            </span>
          )}
        </button>
        <button
          onClick={() => setFiltro('pagas')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            filtro === 'pagas'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Pagas
          {totalPagas > 0 && (
            <span className="ml-1.5 rounded-full bg-emerald-500/100/15 text-emerald-400 px-1.5 py-0.5 text-xs">
              {totalPagas}
            </span>
          )}
        </button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-3" />
          <p className="text-sm text-muted-foreground">
            {filtro === 'pendentes'
              ? 'Todos os prestadores já foram pagos este mês.'
              : 'Nenhum pagamento registrado ainda este mês.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Prestador</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Salário base</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">(-) Empréstimo</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Dias</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Pagamento final</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Via / Dados</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">NF</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const base    = moedaBase(item.contrato, item.cripto_moeda)
                const pagto   = moedaPagamento(item.contrato, item.cripto_moeda)
                const converte = base !== pagto
                const dias    = diasMap[item.id] ?? 30
                const jaPago  = pagoSet.has(item.id)

                let deducao = 0
                let temConversaoEmp = false
                let rateIndisponivel = false

                for (const p of item.parcelas) {
                  if (p.moeda === base) {
                    deducao += p.valor
                  } else if (rate) {
                    temConversaoEmp = true
                    deducao += base === 'BRL' ? p.valor * rate : p.valor / rate
                  } else {
                    rateIndisponivel = true
                  }
                }

                const proporcional = (item.salario_base / 30) * dias
                const liquido = proporcional - deducao
                const pagamentoFinal = converte
                  ? rate ? liquido / rate : null
                  : liquido

                const dadosPagamento = item.contrato === 'BRL'
                  ? item.chave_pix
                  : item.carteira_cripto

                const precisaCotacao = converte || temConversaoEmp

                const comissoesPrestador = comissoesByPrestador.get(item.id) ?? []
                const isExpanded = expandedIds.has(item.id)
                const selectedIds = selectedByPrestador[item.id] ?? []
                const comissoesSelecionadas = getComissoesSelecionadas(item.id, comissoesPrestador)

                return (
                  <Fragment key={item.id}>
                    <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">

                      {/* Nome + contrato + comissões */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{item.nome}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${CONTRATO_BADGE[item.contrato]}`}>
                            {CONTRATO_LABEL[item.contrato]}
                          </span>
                          {comissoesPrestador.length > 0 && !jaPago && (
                            <button
                              onClick={() => toggleComissoes(item.id, comissoesPrestador)}
                              title={isExpanded ? 'Ocultar comissões' : 'Ver comissões pendentes'}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                                isExpanded
                                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                              }`}
                            >
                              {isExpanded
                                ? <ChevronDown className="h-3 w-3" />
                                : <ChevronRight className="h-3 w-3" />
                              }
                              {comissoesPrestador.length} com.
                              {isExpanded && comissoesSelecionadas.length > 0 && (
                                <span className="ml-0.5 rounded-full bg-amber-500/30 px-1 text-amber-200">
                                  {comissoesSelecionadas.length}✓
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Salário base */}
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {fmt(item.salario_base, base)}
                      </td>

                      {/* Empréstimo */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {deducao > 0
                          ? <span className="text-red-600">- {fmt(deducao, base)}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>

                      {/* Dias trabalhados */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={dias}
                              onChange={e => setDias(item.id, e.target.value)}
                              className="w-12 rounded border border-border bg-background px-1.5 py-0.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
                            />
                            <span className="text-xs text-muted-foreground">/30</span>
                          </div>
                          <button
                            onClick={() => setFaltaCtx({ prestadorId: item.id, prestadorNome: item.nome })}
                            className="text-xs transition-colors"
                          >
                            {(faltasByPrestador.get(item.id)?.length ?? 0) > 0
                              ? <span className="text-amber-400">{faltasByPrestador.get(item.id)!.length} falta{faltasByPrestador.get(item.id)!.length > 1 ? 's' : ''}</span>
                              : <span className="text-muted-foreground hover:text-foreground">+ falta</span>
                            }
                          </button>
                        </div>
                      </td>

                      {/* Pagamento final */}
                      <td className="px-4 py-3 text-right">
                        {converte ? (
                          <div>
                            <p className="font-bold tabular-nums text-teal-700">
                              {pagamentoFinal !== null ? fmtCripto(pagamentoFinal, pagto as CriptoMoeda) : '—'}
                            </p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {fmtBRL(liquido)}
                            </p>
                          </div>
                        ) : (
                          <span className="font-bold tabular-nums text-teal-700">
                            {pagamentoFinal !== null ? fmt(pagamentoFinal, pagto) : '—'}
                          </span>
                        )}
                        {precisaCotacao && rateIndisponivel && (
                          <p className="text-xs text-red-500 mt-0.5">sem cotação</p>
                        )}
                      </td>

                      {/* Via / dados */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {item.contrato === 'BRL'
                            ? <QrCode className="h-3.5 w-3.5 shrink-0" />
                            : <Wallet className="h-3.5 w-3.5 shrink-0" />
                          }
                          {dadosPagamento ? (
                            <>
                              <span
                                className="font-mono text-foreground cursor-default"
                                title={dadosPagamento}
                              >
                                {truncar(dadosPagamento)}
                              </span>
                              <button
                                onClick={() => copiar(item.id, dadosPagamento)}
                                title="Copiar"
                                className="rounded p-0.5 hover:bg-muted transition-colors"
                              >
                                {copiadoId === item.id
                                  ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                }
                              </button>
                            </>
                          ) : (
                            <span className="italic">não cadastrado</span>
                          )}
                          {item.contrato !== 'BRL' && item.rede_cripto && (
                            <span className="bg-muted rounded px-1 py-0.5 text-muted-foreground">
                              {item.rede_cripto}
                            </span>
                          )}
                          {item.contrato === 'BRL' && item.tipo_chave_pix && (
                            <span className="bg-muted rounded px-1 py-0.5 text-muted-foreground">
                              {TIPO_PIX_LABEL[item.tipo_chave_pix as TipoChavePix] ?? item.tipo_chave_pix}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* NF */}
                      <td className="px-4 py-3 text-center">
                        {jaPago ? (
                          nfPagoMap[item.id]
                            ? <span title="Nota fiscal enviada"><FileCheck2 className="h-4 w-4 mx-auto text-emerald-400" /></span>
                            : <span className="text-muted-foreground/40 text-sm">—</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={nfState[item.id] ?? false}
                            title="Nota fiscal enviada"
                            onChange={(e) => {
                              const v = e.target.checked
                              setNfState(prev => ({ ...prev, [item.id]: v }))
                              startNfTransition(() => atualizarNotaFiscalSalario(item.id, mesAtual, v))
                            }}
                            className="h-4 w-4 cursor-pointer accent-teal-500"
                          />
                        )}
                      </td>

                      {/* Ação */}
                      <td className="px-4 py-3 text-center">
                        {jaPago ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/100/15 text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Pago
                          </span>
                        ) : (
                          <button
                            onClick={() => setPagamentoCtx({
                              prestadorId: item.id,
                              prestadorNome: item.nome,
                              moeda: pagto,
                              carteiraCripto: item.carteira_cripto,
                              redeCripto: item.rede_cripto,
                              chavePix: item.chave_pix,
                              valorSugerido: pagamentoFinal,
                              rate: rate ?? null,
                              dias,
                              defaultMes,
                              parcelaIds: item.parcelas.map(p => p.id),
                              notaFiscal: nfState[item.id] ?? false,
                              comissoesSelecionadas,
                            })}
                            className="rounded-lg bg-teal-500/10 border border-teal-200 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-500/100/20 transition-colors"
                          >
                            Registrar
                            {comissoesSelecionadas.length > 0 && (
                              <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.5">
                                +{comissoesSelecionadas.length}
                              </span>
                            )}
                          </button>
                        )}
                      </td>

                    </tr>

                    {/* Painel de comissões expandido */}
                    {isExpanded && comissoesPrestador.length > 0 && (
                      <tr className="border-b border-amber-500/10 bg-amber-500/[0.03]">
                        <td colSpan={8} className="px-6 pb-3 pt-1">
                          <p className="text-xs font-medium text-amber-400/70 uppercase tracking-wide mb-2">
                            Comissões pendentes — incluir no pagamento
                          </p>
                          <div className="space-y-1">
                            {comissoesPrestador.map(c => {
                              const valor = calcularValorComissao(c.receitaEther, c.percentual, c.moedaVenda, c.moeda, rate)
                              const isChecked = selectedIds.includes(c.cpId)
                              const semCotacao = valor === null

                              return (
                                <label
                                  key={c.cpId}
                                  className={`flex items-center justify-between gap-3 py-1.5 px-2 rounded-lg transition-colors ${
                                    semCotacao
                                      ? 'opacity-50 cursor-not-allowed'
                                      : 'cursor-pointer hover:bg-amber-500/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isChecked && !semCotacao}
                                      disabled={semCotacao}
                                      onChange={() => !semCotacao && toggleComissaoItem(item.id, c.cpId)}
                                      className="h-4 w-4 accent-amber-500 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm font-medium text-foreground">{c.tipo}</span>
                                      {c.descricao && (
                                        <span className="text-sm text-muted-foreground">— {c.descricao}</span>
                                      )}
                                      {c.previsaoPagamento && (
                                        <span className="text-xs text-muted-foreground/50">
                                          prev. {c.previsaoPagamento.substring(0, 7)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-medium tabular-nums shrink-0 ${
                                    semCotacao
                                      ? 'text-amber-400 text-xs'
                                      : isChecked
                                        ? 'text-amber-400'
                                        : 'text-muted-foreground/50'
                                  }`}>
                                    {semCotacao ? 'sem cotação' : fmt(valor!, c.moeda)}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <RegistrarPagamentoSalarioDialog
        context={pagamentoCtx}
        onClose={(mesRegistrado) => {
          setPagamentoCtx(null)
          if (mesRegistrado) {
            router.replace(`/resumo?mes=${mesRegistrado}`)
          } else {
            const qs = searchParams.toString()
            router.replace(pathname + (qs ? `?${qs}` : ''))
          }
        }}
      />

      <FaltasDialog
        isOpen={!!faltaCtx}
        onClose={(updated) => {
          setFaltaCtx(null)
          if (updated) {
            const qs = searchParams.toString()
            router.replace(pathname + (qs ? `?${qs}` : ''))
          }
        }}
        prestadorId={faltaCtx?.prestadorId ?? ''}
        prestadorNome={faltaCtx?.prestadorNome ?? ''}
        mesAtual={mesReferencia}
        faltas={faltaCtx ? (faltasByPrestador.get(faltaCtx.prestadorId) ?? []) : []}
      />
    </>
  )
}
