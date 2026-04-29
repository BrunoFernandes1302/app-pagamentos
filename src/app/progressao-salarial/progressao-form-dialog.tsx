'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { criarProgressao, atualizarProgressao } from './actions'
import type { ProgressaoSalarial, TipoContrato } from '@/lib/types'

const schema = z
  .object({
    prestador_id: z.string().min(1, 'Selecione um prestador'),
    salario_inicial: z.coerce.number().positive('Deve ser maior que zero'),
    incremento: z.coerce.number().positive('Deve ser maior que zero'),
    salario_alvo: z.coerce.number().positive('Deve ser maior que zero'),
    mes_inicio: z.string().min(1, 'Informe o mês de início'),
  })
  .refine((d) => d.salario_alvo > d.salario_inicial, {
    message: 'Salário alvo deve ser maior que o salário inicial',
    path: ['salario_alvo'],
  })

type FormData = z.infer<typeof schema>

export type PrestadorSimples = {
  id: string
  nome: string
  contrato: TipoContrato
  salario_base: number
}

function getMesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function calcularPreview(
  salarioInicial: number,
  incremento: number,
  salarioAlvo: number,
  mesInicio: string,
): { totalMeses: number; mesConclusao: string } | null {
  if (!salarioInicial || !incremento || !salarioAlvo) return null
  if (salarioAlvo <= salarioInicial || incremento <= 0) return null
  const totalMeses = Math.ceil((salarioAlvo - salarioInicial) / incremento)
  const mesConclusaoDate = addMonths(parseISO(mesInicio + '-01'), totalMeses - 1)
  return {
    totalMeses,
    mesConclusao: format(mesConclusaoDate, "MMMM 'de' yyyy", { locale: ptBR }),
  }
}

interface Props {
  isOpen: boolean
  onClose: () => void
  progressao: ProgressaoSalarial | null
  prestadores: PrestadorSimples[]
  prestadoresComProgressao: Set<string>
  defaultPrestadorId?: string | null
}

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

export default function ProgressaoFormDialog({
  isOpen,
  onClose,
  progressao,
  prestadores,
  prestadoresComProgressao,
  defaultPrestadorId,
}: Props) {
  const isEditing = progressao !== null
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      prestador_id: '',
      salario_inicial: 0,
      incremento: 0,
      salario_alvo: 0,
      mes_inicio: getMesAtual(),
    },
  })

  const [salarioInicial, incremento, salarioAlvo, mesInicio, prestadorId] = form.watch([
    'salario_inicial',
    'incremento',
    'salario_alvo',
    'mes_inicio',
    'prestador_id',
  ])

  const selectedPrestador = prestadores.find((p) => p.id === prestadorId)
  const moedaLabel = selectedPrestador?.contrato === 'USDT' ? 'USDT' : 'R$'

  const preview = calcularPreview(salarioInicial, incremento, salarioAlvo, mesInicio || getMesAtual())

  const prestadoresDisponiveis = isEditing
    ? prestadores
    : prestadores.filter((p) => !prestadoresComProgressao.has(p.id))

  useEffect(() => {
    if (!isOpen) return
    setServerError(null)

    if (progressao) {
      form.reset({
        prestador_id: progressao.prestador_id,
        salario_inicial: progressao.salario_inicial,
        incremento: progressao.incremento,
        salario_alvo: progressao.salario_alvo,
        mes_inicio: progressao.mes_inicio.substring(0, 7),
      })
    } else {
      const defaultP = defaultPrestadorId
        ? prestadores.find((p) => p.id === defaultPrestadorId)
        : null
      form.reset({
        prestador_id: defaultPrestadorId ?? '',
        salario_inicial: defaultP?.salario_base ?? 0,
        incremento: 0,
        salario_alvo: 0,
        mes_inicio: getMesAtual(),
      })
    }
  }, [isOpen, progressao, prestadores, defaultPrestadorId]) // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(data: FormData) {
    setServerError(null)
    startTransition(async () => {
      try {
        if (isEditing && progressao) {
          await atualizarProgressao(progressao.id, {
            salario_inicial: data.salario_inicial,
            incremento: data.incremento,
            salario_alvo: data.salario_alvo,
            mes_inicio: data.mes_inicio,
          })
        } else {
          await criarProgressao(data)
        }
        onClose()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-xl">

          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {isEditing ? 'Editar Progressão' : 'Nova Progressão Salarial'}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="p-6 space-y-5">

              {/* Prestador */}
              {isEditing ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Prestador</p>
                  <p className="text-sm font-medium text-foreground">{progressao.prestadores?.nome}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Prestador <span className="text-destructive">*</span>
                  </label>
                  <select {...form.register('prestador_id')} className={inputClass}>
                    <option value="">Selecione...</option>
                    {prestadoresDisponiveis.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  {prestadoresDisponiveis.length === 0 && (
                    <p className="mt-1 text-xs text-amber-400">
                      Todos os prestadores já possuem uma progressão ativa.
                    </p>
                  )}
                  <FieldError message={form.formState.errors.prestador_id?.message} />
                </div>
              )}

              {/* Salário inicial */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Salário inicial ({moedaLabel}) <span className="text-destructive">*</span>
                </label>
                <input
                  {...form.register('salario_inicial')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className={inputClass}
                />
                <FieldError message={form.formState.errors.salario_inicial?.message} />
              </div>

              {/* Incremento */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Incremento mensal ({moedaLabel}) <span className="text-destructive">*</span>
                </label>
                <input
                  {...form.register('incremento')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Valor adicionado ao salário a cada mês
                </p>
                <FieldError message={form.formState.errors.incremento?.message} />
              </div>

              {/* Salário alvo */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Salário alvo ({moedaLabel}) <span className="text-destructive">*</span>
                </label>
                <input
                  {...form.register('salario_alvo')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className={inputClass}
                />
                <FieldError message={form.formState.errors.salario_alvo?.message} />
              </div>

              {/* Mês início */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Mês de início <span className="text-destructive">*</span>
                </label>
                <input
                  {...form.register('mes_inicio')}
                  type="month"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Primeiro mês em que o incremento será aplicado
                </p>
                <FieldError message={form.formState.errors.mes_inicio?.message} />
              </div>

              {/* Preview */}
              {preview && (
                <div className="rounded-lg bg-violet-500/10 border border-violet-100 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                    Previsão
                  </p>
                  <p className="text-sm text-violet-900">
                    Conclusão em{' '}
                    <span className="font-semibold capitalize">{preview.mesConclusao}</span>
                  </p>
                  <p className="text-sm text-violet-900">
                    Total de{' '}
                    <span className="font-semibold">{preview.totalMeses} {preview.totalMeses === 1 ? 'mês' : 'meses'}</span>{' '}
                    de progressão
                  </p>
                </div>
              )}

              {serverError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {serverError}
                </div>
              )}
            </div>

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
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Salvar alterações' : 'Criar progressão'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
