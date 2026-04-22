'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function atualizarComprovante(id: string, comprovante: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('historico_pagamentos')
    .update({ comprovante: comprovante.trim() || null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/historico')
}

export async function atualizarPagoEm(id: string, pagoEm: string) {
  const supabase = await createClient()
  const d = new Date(pagoEm)
  const mesReferencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

  const { error } = await supabase
    .from('historico_pagamentos')
    .update({ pago_em: pagoEm, mes_referencia: mesReferencia })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/historico')
}

export async function excluirPagamento(
  id: string,
  tipo: string,
  comissaoPrestadorId: string | null,
) {
  const supabase = await createClient()

  if (tipo === 'comissao' && comissaoPrestadorId) {
    const { error: errReset } = await supabase
      .from('comissao_prestadores')
      .update({ pago: false, valor_comissao: null })
      .eq('id', comissaoPrestadorId)
    if (errReset) throw new Error(errReset.message)
  }

  const { error } = await supabase
    .from('historico_pagamentos')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/historico')
  if (tipo === 'comissao') revalidatePath('/comissoes')
}
