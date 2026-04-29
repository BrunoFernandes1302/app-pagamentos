'use server'

import { revalidatePath } from 'next/cache'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'

export async function registrarFalta(data: {
  prestador_id: string
  data: string
  motivo: string | null
}) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('faltas')
    .insert({ ...data, organization_id: orgId })
  if (error) throw new Error('Erro ao registrar falta.')
  revalidatePath('/resumo')
}

export async function registrarFaltasPeriodo(data: {
  prestador_id: string
  dataInicio: string
  dataFim: string
  motivo: string | null
}) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const records = eachDayOfInterval({
    start: parseISO(data.dataInicio),
    end: parseISO(data.dataFim),
  }).map(d => ({
    organization_id: orgId,
    prestador_id: data.prestador_id,
    data: format(d, 'yyyy-MM-dd'),
    motivo: data.motivo,
  }))

  const { error } = await supabase.from('faltas').insert(records)
  if (error) throw new Error('Erro ao registrar faltas.')
  revalidatePath('/resumo')
}

export async function excluirFalta(id: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('faltas')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao excluir falta.')
  revalidatePath('/resumo')
}
