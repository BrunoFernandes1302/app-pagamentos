'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2, Wallet, QrCode, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react'
import { registrarPagamentoSalario, registrarPagamentoCombinado } from './actions'
import { atualizarComprovanteArquivo } from '../historico/actions'
import ArquivoComprovanteField from '@/components/arquivo-comprovante-field'
import type { MoedaSimples } from '@/lib/types'

export interface ComissaoPendente {
  cpId: string
  comissaoId: string
  tipo: string
  descricao: string
  receitaEther: number
  percentual: number
  moedaVenda: MoedaSimples
  moeda: MoedaSimples
  previsaoPagamento: string | null
  notaFiscal: boolean
}

export interface ComissaoPagamento {
  cpId: string
  comissaoId: string
  tipo: string
  descricao: string
  valor: number
  moeda: MoedaSimples
  notaFiscal: boolean
}

export interface SalarioPagamentoContext {
  prestadorId: string
  prestadorNome: string
  moeda: MoedaSimples
  carteiraCripto: string | null
  redeCripto: string | null
  chavePix: string | null
  valorSugerido: number | null
  rate: number | null
  dias: number
  defaultMes: string
  parcelaIds: string[]
  notaFiscal: boolean
  comissoesSelecionadas: ComissaoPagamento[]
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const schema = z.object({
  valor: z.coerce.number().positive('Valor deve ser maior que zero'),
  comprovante: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

interface ComissaoEdit {
  valor: string
  comprovante: string
}

function fmtMoeda(v: number, moeda: MoedaSimples) {
  if (moeda === 'BRL')
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${moeda}`
}

function ResumoTotal({
  moedaSalario,
  valorSalarioStr,
  comissoes,
  comissaoEdits,
}: {
  moedaSalario: MoedaSimples
  valorSalarioStr: string
  comissoes: ComissaoPagamento[]
  comissaoEdits: Record<string, ComissaoEdit>
}) {
  const totalPorMoeda: Record<string, number> = {}

  const salario = parseFloat(valorSalarioStr) || 0
  if (salario > 0) {
    totalPorMoeda[moedaSalario] = (totalPorMoeda[moedaSalario] ?? 0) + salario
  }

  for (const c of comissoes) {
    const v = parseFloat(comissaoEdits[c.cpId]?.valor ?? '') || c.valor
    totalPorMoeda[c.moeda] = (totalPorMoeda[c.moeda] ?? 0) + v
  }

  const moedas = Object.keys(totalPorMoeda) as MoedaSimples[]
  const unimoeda = moedas.length === 1

  return (
    <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 px-4 py-3 space-y-2">
      <p className="text-xs font-medium text-teal-400 uppercase tracking-wide">Total do pagamento</p>
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Salário</span>
          <span className="tabular-nums">{fmtMoeda(parseFloat(valorSalarioStr) || 0, moedaSalario)}</span>
        </div>
        {comissoes.map(c => (
          <div key={c.cpId} className="flex justify-between text-sm text-muted-foreground">
            <span className="truncate pr-2">{c.tipo}{c.descricao ? ` — ${c.descricao}` : ''}</span>
            <span className="tabular-nums shrink-0">
              {fmtMoeda(parseFloat(comissaoEdits[c.cpId]?.valor ?? '') || c.valor, c.moeda)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-teal-500/20 pt-2 space-y-1">
        {moedas.map(moeda => (
          <div key={moeda} className="flex justify-between">
            <span className="text-sm font-semibold text-foreground">
              {unimoeda ? 'Total' : `Total ${moeda}`}
            </span>
            <span className="text-sm font-bold tabular-nums text-teal-400">
              {fmtMoeda(totalPorMoeda[moeda], moeda)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  context: SalarioPagamentoContext | null
  onClose: (mesRegistrado?: string) => void
}

export default function RegistrarPagamentoSalarioDialog({ context, onClose }: Props) {
  const [selectedMes, setSelectedMes] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [comissaoEdits, setComissaoEdits] = useState<Record<string, ComissaoEdit>>({})
  const [replicarHash, setReplicarHash] = useState(false)
  const [arquivoSalario, setArquivoSalario] = useState<File | null>(null)

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { valor: 0 },
  })

  useEffect(() => {
    if (!context) return
    form.reset({
      valor: context.valorSugerido !== null
        ? parseFloat(context.valorSugerido.toFixed(4))
        : 0,
      comprovante: '',
    })
    setSelectedMes(context.defaultMes)
    setServerError(null)
    setReplicarHash(false)
    setArquivoSalario(null)
    const init: Record<string, ComissaoEdit> = {}
    for (const c of context.comissoesSelecionadas) {
      init[c.cpId] = { valor: parseFloat(c.valor.toFixed(4)).toString(), comprovante: '' }
    }
    setComissaoEdits(init)
  }, [context, form])

  const comprovanteValue = form.watch('comprovante')

  useEffect(() => {
    if (!replicarHash || !context) return
    setComissaoEdits(prev => {
      const next = { ...prev }
      for (const c of context.comissoesSelecionadas) {
        next[c.cpId] = { ...next[c.cpId], comprovante: comprovanteValue ?? '' }
      }
      return next
    })
  }, [replicarHash, comprovanteValue, context])

  function setComissaoField(cpId: string, field: keyof ComissaoEdit, value: string) {
    setComissaoEdits(prev => ({ ...prev, [cpId]: { ...prev[cpId], [field]: value } }))
  }

  function navegarMes(delta: number) {
    const [ano, mes] = selectedMes.split('-').map(Number)
    let novoMes = mes + delta
    let novoAno = ano
    if (novoMes > 12) { novoMes = 1; novoAno++ }
    if (novoMes < 1) { novoMes = 12; novoAno-- }
    setSelectedMes(`${novoAno}-${String(novoMes).padStart(2, '0')}`)
  }

  function onSubmit(data: FormData) {
    if (!context) return
    setServerError(null)

    const [anoNum, mesNum] = selectedMes.split('-').map(Number)
    const nomeMes = `${MESES[mesNum - 1]} de ${anoNum}`
    const descricao = `Salário: ${context.dias}/30 dias — ${nomeMes}`

    startTransition(async () => {
      try {
        let historicoId: string
        if (context.comissoesSelecionadas.length > 0) {
          const res = await registrarPagamentoCombinado({
            prestadorId: context.prestadorId,
            prestadorNome: context.prestadorNome,
            valorSalario: data.valor,
            moedaSalario: context.moeda,
            mesReferencia: `${selectedMes}-01`,
            descricaoSalario: descricao,
            parcelaIds: context.parcelaIds,
            notaFiscalSalario: context.notaFiscal,
            comprovante: data.comprovante?.trim() || null,
            comissoes: context.comissoesSelecionadas.map(c => {
              const edit = comissaoEdits[c.cpId]
              const valor = parseFloat(edit?.valor ?? '') || c.valor
              const comprovante = edit?.comprovante?.trim() || null
              return { cpId: c.cpId, comissaoId: c.comissaoId, tipo: c.tipo, descricao: c.descricao, valor, moeda: c.moeda, notaFiscal: c.notaFiscal, comprovante }
            }),
          })
          historicoId = res.historicoId
        } else {
          const res = await registrarPagamentoSalario({
            prestadorId: context.prestadorId,
            prestadorNome: context.prestadorNome,
            valor: data.valor,
            moeda: context.moeda,
            mesReferencia: `${selectedMes}-01`,
            descricao,
            parcelaIds: context.parcelaIds,
            notaFiscal: context.notaFiscal,
            comprovante: data.comprovante?.trim() || null,
          })
          historicoId = res.historicoId
        }
        if (arquivoSalario) {
          const fd = new FormData()
          fd.append('arquivo', arquivoSalario)
          await atualizarComprovanteArquivo(historicoId, fd)
        }
        onClose(selectedMes)
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Erro ao registrar pagamento.')
      }
    })
  }

  if (!context) return null

  const isUsdt = context.moeda !== 'BRL'
  const paymentInfo = isUsdt ? context.carteiraCripto : context.chavePix
  const [anoNum, mesNum] = selectedMes.split('-').map(Number)
  const nomeMes = `${MESES[mesNum - 1]} ${anoNum}`
  const temComissoes = context.comissoesSelecionadas.length > 0

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {temComissoes ? 'Registrar Salário + Comissões' : 'Registrar Pagamento de Salário'}
            </h2>
            <button
              onClick={() => onClose()}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="p-6 space-y-5">

              {/* Prestador */}
              <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prestador</p>
                <p className="font-semibold text-foreground">{context.prestadorNome}</p>
                <p className="text-sm text-muted-foreground">
                  {context.dias}/30 dias · pagamento em {context.moeda}
                </p>
              </div>

              {/* Dados de pagamento */}
              {paymentInfo ? (
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {isUsdt ? <Wallet className="h-3.5 w-3.5 shrink-0" /> : <QrCode className="h-3.5 w-3.5 shrink-0" />}
                  <span className="font-mono break-all">{paymentInfo}</span>
                  {isUsdt && context.redeCripto && (
                    <span className="shrink-0 rounded bg-background border border-border px-1.5 py-0.5 font-sans">
                      {context.redeCripto}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-400">
                  Dados de pagamento em {context.moeda} não cadastrados para este prestador.
                </p>
              )}

              {/* Valor salário */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Valor do salário ({context.moeda}) <span className="text-destructive">*</span>
                </label>
                <input
                  {...form.register('valor')}
                  type="number"
                  step={isUsdt ? '0.0001' : '0.01'}
                  min="0"
                  placeholder="0.00"
                  className={inputClass}
                />
                {context.rate && context.valorSugerido !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cotação usada: R$ {context.rate.toFixed(4)}/USD — ajuste se necessário
                  </p>
                )}
                {context.valorSugerido === null && (
                  <p className="mt-1 text-xs text-amber-400">Cotação indisponível. Informe o valor manualmente.</p>
                )}
                <FieldError message={form.formState.errors.valor?.message} />
              </div>

              {/* Hash / comprovante do salário */}
              <div className="space-y-3">
                {isUsdt ? (
                  <>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Hash da transação <span className="text-muted-foreground font-normal">(opcional)</span>
                    </label>
                    <input
                      {...form.register('comprovante')}
                      type="text"
                      placeholder="0x..."
                      className={inputClass + ' font-mono'}
                    />
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Comprovante PIX (PDF) <span className="text-muted-foreground font-normal">(opcional)</span>
                      </label>
                      <ArquivoComprovanteField onArquivo={setArquivoSalario} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        ID ou descrição <span className="text-muted-foreground font-normal">(opcional)</span>
                      </label>
                      <input
                        {...form.register('comprovante')}
                        type="text"
                        placeholder="ID ou descrição do comprovante"
                        className={inputClass + ' font-mono'}
                      />
                    </div>
                  </>
                )}
                {temComissoes && (
                  <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                    <input
                      type="checkbox"
                      checked={replicarHash}
                      onChange={e => setReplicarHash(e.target.checked)}
                      className="h-3.5 w-3.5 accent-teal-500 cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground">
                      Replicar {isUsdt ? 'hash' : 'comprovante'} para comissões
                    </span>
                  </label>
                )}
              </div>

              {/* Comissões editáveis */}
              {temComissoes && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Comissões incluídas ({context.comissoesSelecionadas.length})
                  </p>
                  {context.comissoesSelecionadas.map(c => {
                    const edit = comissaoEdits[c.cpId] ?? { valor: c.valor.toFixed(4), comprovante: '' }
                    const isCriptoComissao = c.moeda !== 'BRL'
                    return (
                      <div key={c.cpId} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-3">
                        <p className="text-sm font-medium text-foreground">
                          {c.tipo}
                          {c.descricao && <span className="text-muted-foreground font-normal"> — {c.descricao}</span>}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                              Valor ({c.moeda}) <span className="text-destructive">*</span>
                            </label>
                            <input
                              type="number"
                              step={isCriptoComissao ? '0.0001' : '0.01'}
                              min="0"
                              value={edit.valor}
                              onChange={e => setComissaoField(c.cpId, 'valor', e.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                              {isCriptoComissao ? 'Hash' : 'Comprovante'}{' '}
                              <span className="text-muted-foreground/60">(opcional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder={isCriptoComissao ? '0x...' : 'ID...'}
                              value={edit.comprovante}
                              onChange={e => setComissaoField(c.cpId, 'comprovante', e.target.value)}
                              className={inputClass + ' font-mono text-xs'}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Resumo total */}
              {temComissoes && <ResumoTotal
                moedaSalario={context.moeda}
                valorSalarioStr={form.watch('valor')?.toString() ?? '0'}
                comissoes={context.comissoesSelecionadas}
                comissaoEdits={comissaoEdits}
              />}

              {/* Mês de referência */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Mês de referência</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navegarMes(-1)}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex-1 text-center">
                    <p className="font-semibold text-foreground">{nomeMes}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navegarMes(1)}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {serverError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {serverError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4">
              <button
                type="button"
                onClick={() => onClose()}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {temComissoes
                  ? `Registrar Salário + ${context.comissoesSelecionadas.length} comissão${context.comissoesSelecionadas.length > 1 ? 'ões' : ''}`
                  : 'Finalizar Pagamento'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
