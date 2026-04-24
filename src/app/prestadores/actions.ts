'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { PrestadorInput } from '@/lib/types'

export async function criarPrestador(data: PrestadorInput) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('prestadores')
    .insert({ ...data, organization_id: orgId })
  if (error) throw new Error('Erro ao criar prestador.')
  revalidatePath('/prestadores')
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
