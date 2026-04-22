'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2, Wallet, QrCode, ChevronLeft, ChevronRight } from 'lucide-react'
import { registrarPagamentoComissao } from './actions'
import type { MoedaSimples } from '@/lib/types'

export interface PagamentoContext {
  cpId: string
  comissaoId: string
  comissaoTipo: string
  comissaoDescricao: string
  prestadorId: string
  prestadorNome: string
  moeda: MoedaSimples
  carteiraCripto: string | null
  redeCripto: string | null
  chavePix: string | null
  valorSugerido: number | null
  rate: number | null
  defaultMes: string
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function getMesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const schema = z.object({
  valor: z.coerce.number().positive('Valor deve ser maior que zero'),
})

type FormData = z.infer<typeof schema>

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

interface Props {
  context: PagamentoContext | null
  onClose: () => void
}

export default function RegistrarPagamentoDialog({ context, onClose }: Props) {
  const [selectedMes, setSelectedMes] = useState(getMesAtual())
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { valor: 0 },
  })

  useEffect(() => {
    if (!context) return
    form.reset({
      valor: context.valorSugerido !== null
        ? parseFloat(context.valorSugerido.toFixed(4))
        : 0,
    })
    setSelectedMes(context.defaultMes)
    setServerError(null)
  }, [context, form])

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

    startTransition(async () => {
      try {
        await registrarPagamentoComissao({
          cpId: context.cpId,
          comissaoId: context.comissaoId,
          prestadorId: context.prestadorId,
          prestadorNome: context.prestadorNome,
          tipo: context.comissaoTipo,
          descricaoComissao: context.comissaoDescricao,
          valor: data.valor,
          moeda: context.moeda,
          comprovante: null,
          mesReferencia: `${selectedMes}-01`,
        })
        onClose()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Erro ao registrar pagamento.')
      }
    })
  }

  if (!context) return null

  const isUsdt = context.moeda === 'USDT'
  const paymentInfo = isUsdt ? context.carteiraCripto : context.chavePix
  const [anoNum, mesNum] = selectedMes.split('-').map(Number)
  const nomeMes = `${MESES[mesNum - 1]} ${anoNum}`

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Registrar Pagamento</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="p-6 space-y-5">

              {/* Contexto da comissão */}
              <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Comissão</p>
                <p className="font-semibold text-foreground">{context.comissaoTipo}</p>
                <p className="text-sm text-muted-foreground">{context.comissaoDescricao}</p>
              </div>

              {/* Prestador + dados de pagamento */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{context.prestadorNome}</p>
                {paymentInfo ? (
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {isUsdt ? (
                      <Wallet className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <QrCode className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="font-mono break-all">{paymentInfo}</span>
                    {isUsdt && context.redeCripto && (
                      <span className="shrink-0 rounded bg-background border border-border px-1.5 py-0.5 font-sans">
                        {context.redeCripto}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">
                    Dados de pagamento em {context.moeda} não cadastrados para este prestador.
                  </p>
                )}
              </div>

              {/* Valor */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Valor a pagar ({context.moeda}) <span className="text-destructive">*</span>
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
                  <p className="mt-1 text-xs text-amber-600">
                    Cotação indisponível. Informe o valor manualmente.
                  </p>
                )}
                <FieldError message={form.formState.errors.valor?.message} />
              </div>

              {/* Mês de referência */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Mês de referência
                </label>
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
                <p className="mt-1.5 text-xs text-muted-foreground">
                  A hash ou comprovante pode ser adicionada depois, diretamente no Histórico.
                </p>
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
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Finalizar Pagamento
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
