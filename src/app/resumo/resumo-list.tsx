'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Wallet, QrCode, Receipt, Copy, Check, CheckCircle2 } from 'lucide-react'
import { useExchangeRate } from '@/hooks/use-exchange-rate'
import type { TipoContrato, MoedaSimples } from '@/lib/types'
import RegistrarPagamentoSalarioDialog, { type SalarioPagamentoContext } from './registrar-pagamento-dialog'

interface Parcela {
  id: string
  valor: number
  moeda: string
}

interface Item {
  id: string
  nome: string
  contrato: TipoContrato
  salario_base: number
  carteira_cripto: string | null
  rede_cripto: string | null
  chave_pix: string | null
  parcelas: Parcela[]
}

interface Props {
  items: Item[]
  pagoIds: string[]
  mesAtual: string // 'YYYY-MM-DD'
}

const CONTRATO_BADGE: Record<TipoContrato, string> = {
  USDT:       'bg-emerald-100 text-emerald-800',
  'USDT/BRL': 'bg-blue-100 text-blue-800',
  BRL:        'bg-slate-100 text-slate-700',
}

function moedaBase(contrato: TipoContrato): MoedaSimples {
  return contrato === 'USDT' ? 'USDT' : 'BRL'
}

function moedaPagamento(contrato: TipoContrato): MoedaSimples {
  return contrato === 'BRL' ? 'BRL' : 'USDT'
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtUSDT(v: number) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
}

function fmt(v: number, moeda: MoedaSimples) {
  return moeda === 'BRL' ? fmtBRL(v) : fmtUSDT(v)
}

function truncar(s: string, n = 14) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function getMesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Filtro = 'pendentes' | 'pagas'

export default function ResumoList({ items, pagoIds, mesAtual }: Props) {
  const { rate } = useExchangeRate()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [diasMap, setDiasMap] = useState<Record<string, number>>(
    () => Object.fromEntries(items.map(i => [i.id, 30]))
  )
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('pendentes')
  const [pagamentoCtx, setPagamentoCtx] = useState<SalarioPagamentoContext | null>(null)

  const pagoSet = new Set(pagoIds)

  function setDias(id: string, raw: string) {
    const v = parseInt(raw)
    if (isNaN(v)) return
    setDiasMap(prev => ({ ...prev, [id]: Math.max(1, Math.min(30, v)) }))
  }

  function copiar(id: string, valor: string) {
    navigator.clipboard.writeText(valor)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  const defaultMes = mesAtual.substring(0, 7) // 'YYYY-MM'

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
            <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-xs">
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
            <span className="ml-1.5 rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-xs">
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
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const base    = moedaBase(item.contrato)
                const pagto   = moedaPagamento(item.contrato)
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

                const salarioLiquido = item.salario_base - deducao
                const pagamentoBruto = (salarioLiquido / 30) * dias
                const pagamentoFinal = converte
                  ? rate ? pagamentoBruto / rate : null
                  : pagamentoBruto

                const dadosPagamento = item.contrato === 'BRL'
                  ? item.chave_pix
                  : item.carteira_cripto

                const precisaCotacao = converte || temConversaoEmp

                return (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">

                    {/* Nome + contrato */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{item.nome}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${CONTRATO_BADGE[item.contrato]}`}>
                          {item.contrato}
                        </span>
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
                    </td>

                    {/* Pagamento final */}
                    <td className="px-4 py-3 text-right">
                      {converte ? (
                        <div>
                          <p className="font-bold tabular-nums text-teal-700">
                            {pagamentoFinal !== null ? fmtUSDT(pagamentoFinal) : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {fmtBRL(pagamentoBruto)}
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
                      </div>
                    </td>

                    {/* Ação */}
                    <td className="px-4 py-3 text-center">
                      {jaPago ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
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
                          })}
                          className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
                        >
                          Registrar
                        </button>
                      )}
                    </td>

                  </tr>
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
    </>
  )
}
