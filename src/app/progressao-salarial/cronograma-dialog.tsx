'use client'

import { X } from 'lucide-react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ProgressaoSalarial, TipoContrato } from '@/lib/types'

function getSalarioMes(p: ProgressaoSalarial, n: number): number {
  return Math.min(p.salario_inicial + p.incremento * (n + 1), p.salario_alvo)
}

function formatValor(valor: number, contrato: TipoContrato): string {
  if (contrato === 'USDT') {
    return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

interface Props {
  progressao: ProgressaoSalarial & { prestadores: { nome: string; contrato: TipoContrato } }
  onClose: () => void
}

export default function CronogramaDialog({ progressao, onClose }: Props) {
  const totalMeses = Math.ceil(
    (progressao.salario_alvo - progressao.salario_inicial) / progressao.incremento,
  )
  const mesInicioDate = parseISO(progressao.mes_inicio)
  const contrato = progressao.prestadores.contrato

  const rows = Array.from({ length: totalMeses }, (_, i) => {
    const mes = addMonths(mesInicioDate, i)
    const salario = getSalarioMes(progressao, i)
    const salarioAnterior = i === 0 ? progressao.salario_inicial : getSalarioMes(progressao, i - 1)
    const incrementoReal = salario - salarioAnterior
    return { mes, salario, incrementoReal }
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-xl border border-border bg-background shadow-xl">

          <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Cronograma</h2>
              <p className="text-sm text-muted-foreground">{progressao.prestadores.nome}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Mês</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Salário</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Incremento</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ mes, salario, incrementoReal }, i) => {
                  const isCap = incrementoReal < progressao.incremento
                  const isFinal = i === rows.length - 1

                  return (
                    <tr
                      key={i}
                      className={`border-b border-border last:border-0 ${isFinal ? 'bg-emerald-500/10/60' : ''}`}
                    >
                      <td className="px-5 py-2.5 text-foreground capitalize">
                        {format(mes, 'MMM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono font-medium text-foreground">
                        {formatValor(salario, contrato)}
                      </td>
                      <td className={`px-5 py-2.5 text-right font-mono text-xs ${isCap ? 'text-amber-400' : 'text-emerald-400'}`}>
                        +{formatValor(incrementoReal, contrato)}
                        {isCap && <span className="ml-1 text-amber-500">(limite)</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border px-6 py-3 text-xs text-muted-foreground shrink-0">
            {totalMeses} {totalMeses === 1 ? 'mês' : 'meses'} de progressão
            {' · '}
            {formatValor(progressao.salario_inicial, contrato)}
            {' → '}
            {formatValor(progressao.salario_alvo, contrato)}
          </div>
        </div>
      </div>
    </>
  )
}
