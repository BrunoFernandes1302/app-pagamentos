import Link from 'next/link'
import { ArrowLeft, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { aplicarProgressoes } from '@/app/progressao-salarial/actions'
import ResumoList from './resumo-list'

export default async function ResumoPage() {
  await aplicarProgressoes()

  const supabase = await createClient()
  const mesAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const mesLabel = format(startOfMonth(new Date()), "MMMM 'de' yyyy", { locale: ptBR })

  const [{ data: prestadores }, { data: empAtivos }] = await Promise.all([
    supabase
      .from('prestadores')
      .select('id, nome, contrato, salario_base, carteira_cripto, rede_cripto, chave_pix')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('emprestimos')
      .select('id, prestador_id')
      .eq('status', 'ativo'),
  ])

  const empIds = empAtivos?.map(e => e.id) ?? []
  let parcelasRaw: { emprestimo_id: string; valor: number; moeda: string }[] = []

  if (empIds.length > 0) {
    const { data } = await supabase
      .from('parcelas_emprestimo')
      .select('emprestimo_id, valor, moeda')
      .eq('mes_referencia', mesAtual)
      .in('status', ['pendente', 'adiantada'])
      .in('emprestimo_id', empIds)
    parcelasRaw = data ?? []
  }

  const empMap = new Map(empAtivos?.map(e => [e.id, e.prestador_id]) ?? [])
  const parcelasByPrestador = new Map<string, { valor: number; moeda: string }[]>()
  for (const p of parcelasRaw) {
    const prestadorId = empMap.get(p.emprestimo_id)
    if (!prestadorId) continue
    if (!parcelasByPrestador.has(prestadorId)) parcelasByPrestador.set(prestadorId, [])
    parcelasByPrestador.get(prestadorId)!.push({ valor: p.valor, moeda: p.moeda })
  }

  const items = (prestadores ?? []).map(p => ({
    ...p,
    parcelas: parcelasByPrestador.get(p.id) ?? [],
  }))

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-5">
        <div className="mx-auto max-w-6xl flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Início
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">Resumo de Pagamentos</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-fit rounded-lg p-3 bg-teal-50">
            <Receipt className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground capitalize">
              Resumo de Pagamentos — {mesLabel}
            </h1>
            <p className="text-sm text-muted-foreground">
              Salário atual com deduções de empréstimo e ajuste de dias trabalhados
            </p>
          </div>
        </div>

        <ResumoList items={items} />
      </main>
    </div>
  )
}
