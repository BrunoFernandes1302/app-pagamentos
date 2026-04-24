'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import { differenceInMonths, format, parseISO, startOfMonth } from 'date-fns'

interface ProgressaoCreateInput {
  prestador_id: string
  salario_inicial: number
  incremento: number
  salario_alvo: number
  mes_inicio: string
}

interface ProgressaoUpdateInput {
  salario_inicial: number
  incremento: number
  salario_alvo: number
  mes_inicio: string
}

export async function criarProgressao(data: ProgressaoCreateInput) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('progressao_salarial')
    .select('id')
    .eq('prestador_id', data.prestador_id)
    .eq('status', 'ativo')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (existente) throw new Error('Este prestador já possui uma progressão ativa.')

  const { error } = await supabase.from('progressao_salarial').insert({
    prestador_id: data.prestador_id,
    salario_inicial: data.salario_inicial,
    incremento: data.incremento,
    salario_alvo: data.salario_alvo,
    mes_inicio: data.mes_inicio + '-01',
    status: 'ativo',
    organization_id: orgId,
  })

  if (error) throw new Error('Erro ao criar progressão.')
  revalidatePath('/progressao-salarial')
}

export async function atualizarProgressao(id: string, data: ProgressaoUpdateInput) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('progressao_salarial')
    .update({
      salario_inicial: data.salario_inicial,
      incremento: data.incremento,
      salario_alvo: data.salario_alvo,
      mes_inicio: data.mes_inicio + '-01',
    })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) throw new Error('Erro ao atualizar progressão.')
  revalidatePath('/progressao-salarial')
}

export async function cancelarProgressao(id: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { data: p } = await supabase
    .from('progressao_salarial')
    .select('mes_inicio')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (p) {
    const iniciaMesAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    if (p.mes_inicio <= iniciaMesAtual) {
      throw new Error('Não é possível cancelar uma progressão que já foi iniciada.')
    }
  }

  const { error } = await supabase
    .from('progressao_salarial')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) throw new Error('Erro ao cancelar progressão.')
  revalidatePath('/progressao-salarial')
}

export async function aplicarProgressoes() {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const inicioMesAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const { data: progressoes } = await supabase
    .from('progressao_salarial')
    .select('*')
    .eq('status', 'ativo')
    .eq('organization_id', orgId)
    .lte('mes_inicio', inicioMesAtual)

  if (!progressoes?.length) return

  for (const p of progressoes) {
    const mesInicioDate = parseISO(p.mes_inicio)
    const mesAtualDate = startOfMonth(new Date())
    const n = differenceInMonths(mesAtualDate, mesInicioDate)
    const salarioAtual = Math.min(
      p.salario_inicial + p.incremento * (n + 1),
      p.salario_alvo,
    )

    await supabase
      .from('prestadores')
      .update({ salario_base: salarioAtual })
      .eq('id', p.prestador_id)
      .eq('organization_id', orgId)

    if (salarioAtual >= p.salario_alvo) {
      await supabase
        .from('progressao_salarial')
        .update({ status: 'concluido' })
        .eq('id', p.id)
        .eq('organization_id', orgId)
    }
  }
}
