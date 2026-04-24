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
    comprovante: null,
    mes_referencia: input.mesReferencia,
    organization_id: orgId,
  })

  if (error) throw new Error('Erro ao registrar pagamento.')

  revalidatePath('/resumo')
  revalidatePath('/historico')
}
