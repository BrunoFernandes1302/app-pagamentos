'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { MoedaSimples } from '@/lib/types'

interface RegistrarPagamentoSalarioInput {
  prestadorId: string
  prestadorNome: string
  valor: number
  moeda: MoedaSimples
  mesReferencia: string
  descricao: string
  parcelaIds: string[]
  notaFiscal: boolean
  comprovante: string | null
}

export async function atualizarNotaFiscalSalario(
  prestadorId: string,
  mesReferencia: string,
  enviada: boolean,
) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notas_fiscais_salario')
    .upsert(
      { prestador_id: prestadorId, mes_referencia: mesReferencia, enviada, organization_id: orgId },
      { onConflict: 'prestador_id,mes_referencia,organization_id' },
    )

  if (error) throw new Error('Erro ao atualizar nota fiscal.')
}

export async function registrarPagamentoSalario(input: RegistrarPagamentoSalarioInput) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { error } = await supabase.from('historico_pagamentos').insert({
    tipo: 'salario',
    referencia_id: null,
    comissao_prestador_id: null,
    prestador_id: input.prestadorId,
    prestador_nome: input.prestadorNome,
    descricao: input.descricao,
    valor: input.valor,
    moeda: input.moeda,
    comprovante: input.comprovante,
    nota_fiscal: input.notaFiscal,
    mes_referencia: input.mesReferencia,
    organization_id: orgId,
    parcelas_emprestimo_ids: input.parcelaIds.length > 0 ? input.parcelaIds : null,
  })

  if (error) throw new Error('Erro ao registrar pagamento.')

  if (input.parcelaIds.length > 0) {
    const { data: parcelasInfo } = await supabase
      .from('parcelas_emprestimo')
      .select('emprestimo_id')
      .in('id', input.parcelaIds)
      .eq('organization_id', orgId)

    const emprestimoIds = [...new Set(parcelasInfo?.map(p => p.emprestimo_id) ?? [])]

    await supabase
      .from('parcelas_emprestimo')
      .update({
        status: 'paga',
        tipo_pagamento: 'desconto_salario',
        data_pagamento: new Date().toISOString(),
      })
      .in('id', input.parcelaIds)
      .eq('organization_id', orgId)

    for (const empId of emprestimoIds) {
      const { data: pendentes } = await supabase
        .from('parcelas_emprestimo')
        .select('id')
        .eq('emprestimo_id', empId)
        .in('status', ['pendente', 'adiantada'])
        .eq('organization_id', orgId)

      if (!pendentes || pendentes.length === 0) {
        await supabase
          .from('emprestimos')
          .update({ status: 'quitado' })
          .eq('id', empId)
          .eq('organization_id', orgId)
      }
    }
  }

  revalidatePath('/resumo')
  revalidatePath('/historico')
  revalidatePath('/emprestimos')
}
