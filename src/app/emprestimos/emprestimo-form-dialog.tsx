'use client'

import { useEffect, useMemo, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { criarEmprestimo } from './actions'
import type { Emprestimo } from '@/lib/types'

const schema = z.object({
  prestador_id: z.string().min(1, 'Selecione um prestador'),
  valor_total: z.coerce.number().positive('Deve ser maior que zero'),
  moeda: z.enum(['BRL', 'USDT', 'USDC']),
  numero_parcelas: z.coerce.number().int().min(1, 'Mínimo 1').max(120),
  mes_inicio: z.string().optional(),
  modo_multiplos: z.enum(['sequencial', 'acumulado']).optional(),
  observacoes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  prestadores: { id: string; nome: string }[]
  emprestimosAtivos: Emprestimo[]
  onClose: () => void
  onSuccess: () => void
}

export default function EmprestimoFormDialog({ prestadores, emprestimosAtivos, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { moeda: 'BRL', numero_parcelas: 1 },
  })

  const prestadorId = watch('prestador_id')
  const valorTotal = watch('valor_total')
  const numeroParcelas = watch('numero_parcelas')
  const moeda = watch('moeda')
  const modoMultiplos = watch('modo_multiplos')

  const emprestimoAtivo = useMemo(
    () => emprestimosAtivos.find(e => e.prestador_id === prestadorId && e.status === 'ativo'),
    [emprestimosAtivos, prestadorId],
  )

  const mesInicioSequencial = useMemo(() => {
    if (!emprestimoAtivo?.parcelas_emprestimo) return null
    const pendentes = emprestimoAtivo.parcelas_emprestimo
      .filter(p => p.status === 'pendente' || p.status === 'adiantada')
      .sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia))
    if (!pendentes.length) return null
    return addMonths(parseISO(pendentes[0].mes_referencia), 1)
  }, [emprestimoAtivo])

  useEffect(() => {
    if (modoMultiplos === 'sequencial' && mesInicioSequencial) {
      setValue('mes_inicio', format(mesInicioSequencial, 'yyyy-MM'))
    }
  }, [modoMultiplos, mesInicioSequencial, setValue])

  useEffect(() => {
    if (!emprestimoAtivo) setValue('modo_multiplos', undefined)
  }, [emprestimoAtivo, setValue])

  const valorParcela = valorTotal > 0 && numeroParcelas > 0
    ? valorTotal / numeroParcelas
    : null

  const fmt = (v: number) => moeda === 'BRL'
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    : `${v.toFixed(4)} ${moeda}`

  const onSubmit = (data: FormData) => {
    const precisaMesInicio = !emprestimoAtivo || data.modo_multiplos === 'acumulado'
    if (precisaMesInicio && !data.mes_inicio) {
      setError('mes_inicio', { message: 'Selecione o mês de início' })
      return
    }
    if (emprestimoAtivo && !data.modo_multiplos) {
      setError('modo_multiplos', { message: 'Selecione uma opção' })
      return
    }

    startTransition(async () => {
      try {
        await criarEmprestimo({
          prestador_id: data.prestador_id,
          valor_total: data.valor_total,
          numero_parcelas: data.numero_parcelas,
          moeda: data.moeda as 'BRL' | 'USDT' | 'USDC',
          mes_inicio: data.mes_inicio ?? format(new Date(), 'yyyy-MM'),
          modo_multiplos: data.modo_multiplos,
          emprestimo_ativo_id: emprestimoAtivo?.id,
          observacoes: data.observacoes,
        })
        onSuccess()
      } catch {
        alert('Erro ao criar empréstimo. Tente novamente.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Novo Empréstimo</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {/* Prestador */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Prestador</label>
            <select
              {...register('prestador_id')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione...</option>
              {prestadores.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            {errors.prestador_id && <p className="mt-1 text-xs text-destructive">{errors.prestador_id.message}</p>}
          </div>

          {/* Aviso: prestador já tem empréstimo ativo */}
          {emprestimoAtivo && (
            <div className="rounded-lg border-2 border-amber-400 bg-white px-4 py-3 text-sm space-y-2">
              <p className="font-semibold text-gray-900">Este prestador já possui empréstimo ativo</p>
              <p className="text-xs text-gray-600">
                {emprestimoAtivo.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} {emprestimoAtivo.moeda}
                {' · '}
                {emprestimoAtivo.parcelas_emprestimo?.filter(p => p.status === 'pendente').length ?? '?'} parcelas restantes
              </p>
              <div className="flex flex-col gap-1.5 pt-1">
                {([
                  ['sequencial', 'Sequencial — começa após quitar o atual'],
                  ['acumulado', 'Acumulado — parcelas somam no mesmo mês'],
                ] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" {...register('modo_multiplos')} value={val} className="accent-amber-600" />
                    <span className="text-gray-800 text-xs">{label}</span>
                  </label>
                ))}
              </div>
              {errors.modo_multiplos && (
                <p className="text-xs text-destructive">{errors.modo_multiplos.message}</p>
              )}
            </div>
          )}

          {/* Valor total + moeda */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Valor total</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('valor_total')}
                placeholder="0,00"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.valor_total && <p className="mt-1 text-xs text-destructive">{errors.valor_total.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Moeda</label>
              <select
                {...register('moeda')}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="BRL">BRL</option>
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>

          {/* Número de parcelas */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Número de parcelas</label>
            <input
              type="number"
              min="1"
              max="120"
              {...register('numero_parcelas')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {valorParcela !== null && valorParcela > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {numeroParcelas}x de {fmt(valorParcela)}
              </p>
            )}
            {errors.numero_parcelas && <p className="mt-1 text-xs text-destructive">{errors.numero_parcelas.message}</p>}
          </div>

          {/* Mês de início — exibe se não tem empréstimo ativo OU se modo é acumulado */}
          {(!emprestimoAtivo || modoMultiplos === 'acumulado') && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Mês de início dos descontos
              </label>
              <input
                type="month"
                {...register('mes_inicio')}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.mes_inicio && <p className="mt-1 text-xs text-destructive">{errors.mes_inicio.message}</p>}
            </div>
          )}

          {/* Info do início sequencial */}
          {modoMultiplos === 'sequencial' && mesInicioSequencial && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground">Início calculado automaticamente:</p>
              <p className="font-semibold text-foreground mt-0.5">
                {format(mesInicioSequencial, 'MMMM/yyyy', { locale: ptBR })}
              </p>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Observações <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              {...register('observacoes')}
              rows={2}
              placeholder="Motivo, condições especiais..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : 'Criar empréstimo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
