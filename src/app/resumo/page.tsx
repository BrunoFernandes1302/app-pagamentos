import Link from 'next/link'
import { ArrowLeft, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { addMonths, differenceInMonths, format, parseISO, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { aplicarProgressoes } from '@/app/progressao-salarial/actions'
import MesSelector from '@/app/historico/mes-selector'
import ResumoList from './resumo-list'

function getMesAtual() {
  return format(startOfMonth(new Date()), 'yyyy-MM')
}

function validarMes(mes: string | undefined): string {
  if (!mes) return getMesAtual()
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return mes
  return getMesAtual()
}

export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  await aplicarProgressoes()

  const { mes } = await searchParams
  const mesSelecionado = validarMes(mes) // 'YYYY-MM'
  const supabase = await createClient()
  const mesAtual = `${mesSelecionado}-01`
  const mesLabel = format(parseISO(mesAtual), "MMMM 'de' yyyy", { locale: ptBR })

  const mesFimDate = format(addMonths(parseISO(mesAtual), 1), 'yyyy-MM-dd')

  const [{ data: prestadores }, { data: empAtivos }, { data: pagosNoMes }, { data: progressoes }, { data: faltasDoMes }, { data: nfSalario }] = await Promise.all([
    supabase
      .from('prestadores')
      .select('id, nome, contrato, salario_base, carteira_cripto, rede_cripto, chave_pix, tipo_chave_pix')
      .eq('ativo', true)
      .lt('data_inicio', mesFimDate)
      .order('nome'),
    supabase
      .from('emprestimos')
      .select('id, prestador_id')
      .eq('status', 'ativo'),
    supabase
      .from('historico_pagamentos')
      .select('prestador_id, nota_fiscal')
      .eq('tipo', 'salario')
      .eq('mes_referencia', mesAtual),
    supabase
      .from('progressao_salarial')
      .select('prestador_id, salario_inicial, incremento, salario_alvo, mes_inicio')
      .eq('status', 'ativo'),
    supabase
      .from('faltas')
      .select('id, prestador_id, data, motivo')
      .gte('data', mesAtual)
      .lt('data', mesFimDate),
    supabase
      .from('notas_fiscais_salario')
      .select('prestador_id, enviada')
      .eq('mes_referencia', mesAtual),
  ])

  const mesSelDate = parseISO(mesAtual)
  const progressaoMap = new Map<string, number>()
  for (const prog of progressoes ?? []) {
    const mesInicioDate = parseISO(prog.mes_inicio)
    const n = differenceInMonths(mesSelDate, mesInicioDate)
    const salario = n < 0
      ? prog.salario_inicial
      : Math.min(prog.salario_inicial + prog.incremento * (n + 1), prog.salario_alvo)
    progressaoMap.set(prog.prestador_id, salario)
  }

  const empIds = empAtivos?.map(e => e.id) ?? []
  let parcelasRaw: { id: string; emprestimo_id: string; valor: number; moeda: string }[] = []

  if (empIds.length > 0) {
    const { data } = await supabase
      .from('parcelas_emprestimo')
      .select('id, emprestimo_id, valor, moeda')
      .eq('mes_referencia', mesAtual)
      .in('status', ['pendente', 'adiantada'])
      .in('emprestimo_id', empIds)
    parcelasRaw = data ?? []
  }

  const empMap = new Map(empAtivos?.map(e => [e.id, e.prestador_id]) ?? [])
  const parcelasByPrestador = new Map<string, { id: string; valor: number; moeda: string }[]>()
  for (const p of parcelasRaw) {
    const prestadorId = empMap.get(p.emprestimo_id)
    if (!prestadorId) continue
    if (!parcelasByPrestador.has(prestadorId)) parcelasByPrestador.set(prestadorId, [])
    parcelasByPrestador.get(prestadorId)!.push({ id: p.id, valor: p.valor, moeda: p.moeda })
  }

  const pagoIds = (pagosNoMes ?? [])
    .map(p => p.prestador_id)
    .filter((id): id is string => id !== null)

  const nfPendingMap: Record<string, boolean> = Object.fromEntries(
    (nfSalario ?? []).map(nf => [nf.prestador_id, nf.enviada])
  )
  const nfPagoMap: Record<string, boolean> = Object.fromEntries(
    (pagosNoMes ?? [])
      .filter((p): p is { prestador_id: string; nota_fiscal: boolean } => p.prestador_id !== null)
      .map(p => [p.prestador_id, p.nota_fiscal])
  )

  const items = (prestadores ?? []).map(p => ({
    ...p,
    salario_base: progressaoMap.get(p.id) ?? p.salario_base,
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
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-fit rounded-lg p-3 bg-teal-500/10">
              <Receipt className="h-6 w-6 text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground capitalize">
                Resumo de Pagamentos
              </h1>
              <p className="text-sm text-muted-foreground">
                Salário com deduções de empréstimo e ajuste de dias trabalhados
              </p>
            </div>
          </div>
          <MesSelector mesAtual={mesSelecionado} basePath="/resumo" />
        </div>

        <ResumoList key={mesAtual} items={items} pagoIds={pagoIds} mesAtual={mesAtual} faltas={faltasDoMes ?? []} nfPendingMap={nfPendingMap} nfPagoMap={nfPagoMap} />
      </main>
    </div>
  )
}
