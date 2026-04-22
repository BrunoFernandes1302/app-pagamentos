'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default function MesSelector({ mesAtual }: { mesAtual: string }) {
  const router = useRouter()
  const [ano, mes] = mesAtual.split('-').map(Number)

  function navegar(delta: number) {
    let novoMes = mes + delta
    let novoAno = ano
    if (novoMes > 12) { novoMes = 1; novoAno++ }
    if (novoMes < 1) { novoMes = 12; novoAno-- }
    router.push(`/historico?mes=${novoAno}-${String(novoMes).padStart(2, '0')}`)
  }

  const isMesAtual =
    mesAtual === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navegar(-1)}
        className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="min-w-[160px] text-center">
        <p className="font-semibold text-foreground">
          {MESES[mes - 1]} {ano}
        </p>
        {isMesAtual && (
          <p className="text-xs text-muted-foreground">mês atual</p>
        )}
      </div>

      <button
        onClick={() => navegar(1)}
        className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
