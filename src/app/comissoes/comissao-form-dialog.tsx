'use client'

import { useEffect, useTransition } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2, Plus, Trash2, Wallet, QrCode, TrendingUp } from 'lucide-react'
import { criarComissao, atualizarComissao } from './actions'
import { useExchangeRate } from '@/hooks/use-exchange-rate'
import type { Comissao, PrestadorResumido, MoedaSimples, TipoChavePix } from '@/lib/types'
import { TIPO_PIX_LABEL } from '@/lib/types'
import { useState } from 'react'

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
  prestadores: z.array(prestadorItemSchema).min(1, 'Ao menos um prestador é obrigatório').max(5),
})

type FormData = z.infer<typeof schema>

const DEFAULTS: FormData = {
  tipo: '',
  descricao: '',
  previsao_pagamento: '',
  moeda_venda: 'USDT',
  receita_ether: 0,
  prestadores: [{ prestador_id: '', percentual: 0, moeda_recebimento: 'USDT' }],
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
  const pixTipo = moeda === 'BRL' ? p.tipo_chave_pix : null

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
      {pixTipo && (
        <span className="shrink-0 rounded bg-background border border-border px-1.5 py-0.5 font-sans">
          {TIPO_PIX_LABEL[pixTipo as TipoChavePix] ?? pixTipo}
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
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const { rate, loading: rateLoading, error: rateError } = useExchangeRate()

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: DEFAULTS,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'prestadores',
  })

  const moedaVenda = form.watch('moeda_venda')
  const receita = form.watch('receita_ether') || 0
  const prestadoresWatch = form.watch('prestadores')

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
        prestadores: cp.length > 0
          ? cp.map(p => ({
              prestador_id: p.prestador_id,
              percentual: p.percentual,
              moeda_recebimento: p.moeda_recebimento,
            }))
          : DEFAULTS.prestadores,
      })
    } else {
      form.reset(DEFAULTS)
    }

    setServerError(null)
  }, [isOpen, comissao, form])

  function onSubmit(data: FormData) {
    const ids = data.prestadores.map(p => p.prestador_id)
    const hasDuplicate = ids.some((id, i) => ids.indexOf(id) !== i)
    if (hasDuplicate) {
      form.setError('prestadores', { message: 'Dois ou mais prestadores são iguais.' })
      return
    }

    setServerError(null)

    const payload = {
      tipo: data.tipo,
      descricao: data.descricao,
      previsao_pagamento: data.previsao_pagamento || null,
      moeda_venda: data.moeda_venda,
      receita_ether: data.receita_ether,
      prestadores: data.prestadores.map(p => ({
        prestador_id: p.prestador_id,
        percentual: p.percentual,
        moeda_recebimento: p.moeda_recebimento,
      })),
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

  const needsRate = prestadoresWatch.some(p => p.moeda_recebimento !== moedaVenda)

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

              {/* Lista de prestadores */}
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const pId = prestadoresWatch[index]?.prestador_id ?? ''
                  const pPerc = prestadoresWatch[index]?.percentual ?? 0
                  const pMoeda = (prestadoresWatch[index]?.moeda_recebimento ?? 'USDT') as MoedaSimples
                  const outrosIds = prestadoresWatch
                    .filter((_, i) => i !== index)
                    .map(p => p.prestador_id)
                    .filter(Boolean)

                  return (
                    <div key={field.id}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-foreground">
                          Prestador {index + 1}
                        </p>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remover
                          </button>
                        )}
                      </div>

                      <div className="rounded-lg border border-border p-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1.5">
                            Prestador <span className="text-destructive">*</span>
                          </label>
                          <select
                            {...form.register(`prestadores.${index}.prestador_id`)}
                            className={inputClass}
                          >
                            <option value="">Selecione um prestador</option>
                            {prestadoresAtivos.filter(p => p.ativo && !outrosIds.includes(p.id)).map(p => (
                              <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                            {prestadoresAtivos.some(p => !p.ativo && !outrosIds.includes(p.id)) && (
                              <optgroup label="Inativos">
                                {prestadoresAtivos.filter(p => !p.ativo && !outrosIds.includes(p.id)).map(p => (
                                  <option key={p.id} value={p.id}>{p.nome}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          <FieldError message={form.formState.errors.prestadores?.[index]?.prestador_id?.message} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                              % Comissão <span className="text-destructive">*</span>
                            </label>
                            <input
                              {...form.register(`prestadores.${index}.percentual`)}
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0.00"
                              className={inputClass}
                            />
                            <FieldError message={form.formState.errors.prestadores?.[index]?.percentual?.message} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                              Recebe em <span className="text-destructive">*</span>
                            </label>
                            <select
                              {...form.register(`prestadores.${index}.moeda_recebimento`)}
                              className={inputClass}
                            >
                              <option value="USDT">USDT</option>
                              <option value="BRL">BRL (Reais)</option>
                            </select>
                          </div>
                        </div>

                        <ComissaoPreview
                          receita={receita}
                          percentual={pPerc}
                          moedaVenda={moedaVenda}
                          moedaRecebimento={pMoeda}
                          rate={rate}
                        />

                        {pId && (
                          <PaymentInfo prestadorId={pId} moeda={pMoeda} prestadoresAtivos={prestadoresAtivos} />
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Erro de duplicata */}
                {'message' in (form.formState.errors.prestadores ?? {}) && (
                  <FieldError message={(form.formState.errors.prestadores as { message?: string })?.message} />
                )}

                {/* Botão adicionar */}
                {fields.length < 5 && (
                  <button
                    type="button"
                    onClick={() => append({ prestador_id: '', percentual: 0, moeda_recebimento: 'USDT' })}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Incluir prestador {fields.length + 1}
                  </button>
                )}
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
