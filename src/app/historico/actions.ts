'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'

export async function atualizarComprovante(id: string, comprovante: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('historico_pagamentos')
    .update({ comprovante: comprovante.trim() || null })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao atualizar comprovante.')
  revalidatePath('/historico')
}

export async function atualizarPagoEm(id: string, pagoEm: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const d = new Date(pagoEm)
  const mesReferencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

  const { error } = await supabase
    .from('historico_pagamentos')
    .update({ pago_em: pagoEm, mes_referencia: mesReferencia })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao atualizar data.')
  revalidatePath('/historico')
}

export async function excluirPagamento(
  id: string,
  tipo: string,
  comissaoPrestadorId: string | null,
) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  if (tipo === 'comissao' && comissaoPrestadorId) {
    const { error: errReset } = await supabase
      .from('comissao_prestadores')
      .update({ pago: false, valor_comissao: null })
      .eq('id', comissaoPrestadorId)
      .eq('organization_id', orgId)
    if (errReset) throw new Error('Erro ao excluir pagamento.')
  }

  if (tipo === 'salario') {
    const { data: hist } = await supabase
      .from('historico_pagamentos')
      .select('parcelas_emprestimo_ids')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single()

    const storedIds: string[] = hist?.parcelas_emprestimo_ids ?? []

    if (storedIds.length > 0) {
      const { data: parcelasInfo } = await supabase
        .from('parcelas_emprestimo')
        .select('emprestimo_id')
        .in('id', storedIds)
        .eq('organization_id', orgId)

      const emprestimoIds = [...new Set(parcelasInfo?.map(p => p.emprestimo_id) ?? [])]

      await supabase
        .from('parcelas_emprestimo')
        .update({ status: 'pendente', tipo_pagamento: null, data_pagamento: null })
        .in('id', storedIds)
        .eq('organization_id', orgId)

      if (emprestimoIds.length > 0) {
        await supabase
          .from('emprestimos')
          .update({ status: 'ativo' })
          .in('id', emprestimoIds)
          .eq('status', 'quitado')
          .eq('organization_id', orgId)
      }
    }
  }

  const { error } = await supabase
    .from('historico_pagamentos')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao excluir pagamento.')

  revalidatePath('/historico')
  if (tipo === 'comissao') revalidatePath('/comissoes')
  if (tipo === 'salario') {
    revalidatePath('/emprestimos')
    revalidatePath('/resumo')
  }
}
