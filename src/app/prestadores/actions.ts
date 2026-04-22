'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PrestadorInput } from '@/lib/types'

export async function criarPrestador(data: PrestadorInput) {
  const supabase = await createClient()
  const { error } = await supabase.from('prestadores').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/prestadores')
}

export async function atualizarPrestador(id: string, data: PrestadorInput) {
  const supabase = await createClient()
  const { error } = await supabase.from('prestadores').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/prestadores')
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('prestadores').update({ ativo }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/prestadores')
}

export async function excluirPrestador(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('prestadores').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/prestadores')
}
