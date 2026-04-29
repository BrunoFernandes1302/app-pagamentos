'use server'

import { revalidatePath } from 'next/cache'
import { eachDayOfInterval, format, parseISO, startOfMonth, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { PrestadorInput } from '@/lib/types'

export async function criarPrestador(data: PrestadorInput) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { data: novo, error } = await supabase
    .from('prestadores')
    .insert({ ...data, organization_id: orgId })
    .select('id')
    .single()
  if (error) throw new Error('Erro ao criar prestador.')

  // Registra faltas para os dias anteriores ao início no mesmo mês
  const dataInicio = parseISO(data.data_inicio)
  const primeiroDiaMes = startOfMonth(dataInicio)
  if (dataInicio.getDate() > 1) {
    const dias = eachDayOfInterval({ start: primeiroDiaMes, end: subDays(dataInicio, 1) })
    await supabase.from('faltas').insert(
      dias.map(d => ({
        organization_id: orgId,
        prestador_id: novo.id,
        data: format(d, 'yyyy-MM-dd'),
        motivo: 'Antes do início do contrato',
      }))
    )
  }

  revalidatePath('/prestadores')
  revalidatePath('/resumo')
}

export async function atualizarPrestador(id: string, data: PrestadorInput) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('prestadores')
    .update(data)
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao atualizar prestador.')
  revalidatePath('/prestadores')
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('prestadores')
    .update({ ativo })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao atualizar prestador.')
  revalidatePath('/prestadores')
}

export async function excluirPrestador(id: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('prestadores')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao excluir prestador.')
  revalidatePath('/prestadores')
}
