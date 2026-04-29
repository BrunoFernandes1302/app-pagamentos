'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2, Plus, Trash2, Wallet, QrCode, TrendingUp } from 'lucide-react'
import { criarComissao, atualizarComissao } from './actions'
import { useExchangeRate } from '@/hooks/use-exchange-rate'
import type { Comissao, PrestadorResumido, MoedaSimples } from '@/lib/types'

// ─── Schema ────────────────────────────────────────────────────────────────

const prestadorItemSchema = z.object({
  prestador_id: z.string().min(1, 'Selecione um prestador'),
  percentual: z.coerce.number().positive('Deve ser maior que zero').max(100, 'Máximo 100%'),
  moeda_recebimento: z.enum(['USDT', 'BRL']),
})

const schema = z.object({
  tipo: z.string().min(1, 'Tipo obrigatório'),
  descricao: z.string().min(1, 'Descrição obrigatória'),
  previsao_pagamento: z.string().optional(),
  moeda_venda: z.enum(['USDT', 'BRL']),
  receita_ether: z.coerce.number().positive('Valor deve ser maior que zero'),
  prestador1: prestadorItemSchema,
  prestador2: prestadorItemSchema.optional(),
})

type FormData = z.infer<typeof schema>

const DEFAULTS: FormData = {
  tipo: '',
  descricao: '',
  previsao_pagamento: '',
  moeda_venda: 'USDT',
  receita_ether: 0,
  prestador1: { prestador_id: '', percentual: 0, moeda_recebimento: 'USDT' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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
  if (value === null) return '—'
  if (moeda === 'USDT')
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// ─── Sub-components ────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

function PaymentInfo({
  prestadorId,
  moeda,
  prestadoresAtivos,
}: {
  prestadorId: string
  moeda: MoedaSimples
  prestadoresAtivos: PrestadorResumido[]
}) {
  const p = prestadoresAtivos.find(x => x.id === prestadorId)
  if (!p) return null
  const val = moeda === 'BRL' ? p.chave_pix : p.carteira_cripto
  const rede = moeda === 'USDT' ? p.rede_cripto : null

  if (!val)
    return (
      <p className="mt-2 text-xs text-amber-400">
        Dados de pagamento em {moeda} não cadastrados para este prestador.
      </p>
    )

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
      {moeda === 'BRL' ? <QrCode className="h-3.5 w-3.5 shrink-0" /> : <Wallet className="h-3.5 w-3.5 shrink-0" />}
      <span className="font-mono break-all">{val}</span>
      {rede && (
        <span className="shrink-0 rounded bg-background border border-border px-1.5 py-0.5 font-sans">
          {rede}
        </span>
      )}
    </div>
  )
}

function ComissaoPreview({
  receita,
  percentual,
  moedaVenda,
  moedaRecebimento,
  rate,
}: {
  receita: number
  percentual: number
  moedaVenda: MoedaSimples
  moedaRecebimento: MoedaSimples
  rate: number | null
}) {
  if (!receita || !percentual) return null
  const base = receita * percentual / 100
  const valor = calcularComissao(receita, percentual, moedaVenda, moedaRecebimento, rate)
  const precisaConversao = moedaVenda !== moedaRecebimento

  return (
    <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
      {precisaConversao ? (
        <span className="text-muted-foreground">
          {percentual}% de {formatValor(base, moedaVenda)}{' '}
          <span className="text-foreground font-medium">
            → {valor !== null ? formatValor(valor, moedaRecebimento) : '— (sem cotação)'}
          </span>
          {rate && (
            <span className="ml-2 text-xs text-muted-foreground">
              (R$ {rate.toFixed(4)}/USD)
            </span>
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">
          {percentual}% de {formatValor(receita, moedaVenda)}{' '}
          <span className="text-foreground font-medium">
            = {formatValor(base, moedaRecebimento)}
          </span>
        </span>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  prestadoresAtivos: PrestadorResumido[]
  comissao?: Comissao | null
}

export default function ComissaoFormDialog({ isOpen, onClose, prestadoresAtivos, comissao }: Props) {
  const isEditing = !!comissao
  const [showPrestador2, setShowPrestador2] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const { rate, loading: rateLoading, error: rateError } = useExchangeRate()

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: DEFAULTS,
  })

  const receita = form.watch('receita_ether') || 0
  const moedaVenda = form.watch('moeda_venda')
  const p1Id = form.watch('prestador1.prestador_id')
  const p1Perc = form.watch('prestador1.percentual') || 0
  const p1Moeda = form.watch('prestador1.moeda_recebimento')
  const p2Id = form.watch('prestador2.prestador_id')
  const p2Perc = form.watch('prestador2.percentual') || 0
  const p2Moeda = form.watch('prestador2.moeda_recebimento') ?? 'USDT'

  useEffect(() => {
    if (!isOpen) return

    if (comissao) {
      const cp = comissao.comissao_prestadores
      form.reset({
        tipo: comissao.tipo,
        descricao: comissao.descricao,
        previsao_pagamento: comissao.previsao_pagamento ?? '',
        moeda_venda: comissao.moeda_venda,
        receita_ether: comissao.receita_ether,
        prestador1: {
          prestador_id: cp[0]?.prestador_id ?? '',
          percentual: cp[0]?.percentual ?? 0,
          moeda_recebimento: cp[0]?.moeda_recebimento ?? 'USDT',
        },
        prestador2: cp[1]
          ? {
              prestador_id: cp[1].prestador_id,
              percentual: cp[1].percentual,
              moeda_recebimento: cp[1].moeda_recebimento,
            }
          : undefined,
      })
      setShowPrestador2(cp.length > 1)
    } else {
      form.reset(DEFAULTS)
      setShowPrestador2(false)
    }

    setServerError(null)
  }, [isOpen, comissao, form])

  function removePrestador2() {
    setShowPrestador2(false)
    form.setValue('prestador2', undefined)
    form.clearErrors('prestador2')
  }

  function onSubmit(data: FormData) {
    if (showPrestador2) {
      if (!data.prestador2?.prestador_id) {
        form.setError('prestador2.prestador_id', { message: 'Selecione o segundo prestador' })
        return
      }
      if (data.prestador2.prestador_id === data.prestador1.prestador_id) {
        form.setError('prestador2.prestador_id', { message: 'Selecione um prestador diferente' })
        return
      }
    }

    setServerError(null)

    const prestadores = [
      {
        prestador_id: data.prestador1.prestador_id,
        percentual: data.prestador1.percentual,
        moeda_recebimento: data.prestador1.moeda_recebimento,
      },
    ]

    if (showPrestador2 && data.prestador2) {
      prestadores.push({
        prestador_id: data.prestador2.prestador_id,
        percentual: data.prestador2.percentual,
        moeda_recebimento: data.prestador2.moeda_recebimento,
      })
    }

    const payload = {
      tipo: data.tipo,
      descricao: data.descricao,
      previsao_pagamento: data.previsao_pagamento || null,
      moeda_venda: data.moeda_venda,
      receita_ether: data.receita_ether,
      prestadores,
    }

    startTransition(async () => {
      try {
        if (isEditing && comissao) {
          await atualizarComissao(comissao.id, payload)
        } else {
          await criarComissao(payload)
        }
        onClose()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.')
      }
    })
  }

  if (!isOpen) return null

  const needsRate = moedaVenda !== p1Moeda || (showPrestador2 && moedaVenda !== p2Moeda)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {isEditing ? 'Editar Comissão' : 'Registrar Comissão'}
            </h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="p-6 space-y-5">

              {/* Cotação (apenas quando há conversão envolvida) */}
              {needsRate && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm">
                  <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  {rateLoading && !rate ? (
                    <span className="text-muted-foreground">Obtendo cotação...</span>
                  ) : rateError ? (
                    <span className="text-destructive">{rateError} — conversão indisponível</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Cotação atual:{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        R$ {rate?.toFixed(4)}
                      </span>
                      <span className="text-xs ml-1">(USD/BRL)</span>
                    </span>
                  )}
                </div>
              )}

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Tipo de comissão <span className="text-destructive">*</span>
                </label>
                <input
                  {...form.register('tipo')}
                  placeholder="Ex: Venda de WL, Venda de API, Bônus..."
                  className={inputClass}
                />
                <FieldError message={form.formState.errors.tipo?.message} />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Descrição <span className="text-destructive">*</span>
                </label>
                <textarea
                  {...form.register('descricao')}
                  placeholder="Descreva a comissão..."
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
                <FieldError message={form.formState.errors.descricao?.message} />
              </div>

              {/* Previsão de pagamento */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Previsão de pagamento
                </label>
                <input
                  {...form.register('previsao_pagamento')}
                  type="date"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Define o mês padrão ao registrar o pagamento no Histórico.
                </p>
              </div>

              {/* Moeda da venda / Receita Ether */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Moeda da venda <span className="text-destructive">*</span>
                  </label>
                  <select {...form.register('moeda_venda')} className={inputClass}>
                    <option value="USDT">USDT</option>
                    <option value="BRL">BRL (Reais)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Receita Ether ({moedaVenda}) <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...form.register('receita_ether')}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={inputClass}
                  />
                  <FieldError message={form.formState.errors.receita_ether?.message} />
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Prestador 1 */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">Prestador 1</p>
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Prestador <span className="text-destructive">*</span>
                    </label>
                    <select {...form.register('prestador1.prestador_id')} className={inputClass}>
                      <option value="">Selecione um prestador</option>
                      {prestadoresAtivos.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                    <FieldError message={form.formState.errors.prestador1?.prestador_id?.message} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        % Comissão <span className="text-destructive">*</span>
                      </label>
                      <input
                        {...form.register('prestador1.percentual')}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0.00"
                        className={inputClass}
                      />
                      <FieldError message={form.formState.errors.prestador1?.percentual?.message} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Recebe em <span className="text-destructive">*</span>
                      </label>
                      <select {...form.register('prestador1.moeda_recebimento')} className={inputClass}>
                        <option value="USDT">USDT</option>
                        <option value="BRL">BRL (Reais)</option>
                      </select>
                    </div>
                  </div>

                  <ComissaoPreview
                    receita={receita}
                    percentual={p1Perc}
                    moedaVenda={moedaVenda}
                    moedaRecebimento={p1Moeda}
                    rate={rate}
                  />

                  {p1Id && (
                    <PaymentInfo prestadorId={p1Id} moeda={p1Moeda} prestadoresAtivos={prestadoresAtivos} />
                  )}
                </div>
              </div>

              {/* Prestador 2 */}
              {showPrestador2 ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground">Prestador 2</p>
                    <button
                      type="button"
                      onClick={removePrestador2}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </div>
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Prestador <span className="text-destructive">*</span>
                      </label>
                      <select {...form.register('prestador2.prestador_id')} className={inputClass}>
                        <option value="">Selecione um prestador</option>
                        {prestadoresAtivos
                          .filter(p => p.id !== p1Id)
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.nome}</option>
                          ))}
                      </select>
                      <FieldError message={form.formState.errors.prestador2?.prestador_id?.message} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          % Comissão <span className="text-destructive">*</span>
                        </label>
                        <input
                          {...form.register('prestador2.percentual')}
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="0.00"
                          className={inputClass}
                        />
                        <FieldError message={form.formState.errors.prestador2?.percentual?.message} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                          Recebe em <span className="text-destructive">*</span>
                        </label>
                        <select {...form.register('prestador2.moeda_recebimento')} className={inputClass}>
                          <option value="USDT">USDT</option>
                          <option value="BRL">BRL (Reais)</option>
                        </select>
                      </div>
                    </div>

                    <ComissaoPreview
                      receita={receita}
                      percentual={p2Perc}
                      moedaVenda={moedaVenda}
                      moedaRecebimento={p2Moeda}
                      rate={rate}
                    />

                    {p2Id && (
                      <PaymentInfo prestadorId={p2Id} moeda={p2Moeda} prestadoresAtivos={prestadoresAtivos} />
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowPrestador2(true)
                    form.setValue('prestador2', { prestador_id: '', percentual: 0, moeda_recebimento: 'USDT' })
                  }}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Incluir segundo prestador
                </button>
              )}

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
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/80 transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Salvar alterações' : 'Registrar comissão'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
