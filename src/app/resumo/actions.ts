'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MoedaSimples } from '@/lib/types'

interface RegistrarPagamentoSalarioInput {
  prestadorId: string
  prestadorNome: string
  valor: number
  moeda: MoedaSimples
  mesReferencia: string // 'YYYY-MM-DD'
  descricao: string
}

export async function registrarPagamentoSalario(input: RegistrarPagamentoSalarioInput) {
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
  })

  if (error) throw new Error(error.message)

  revalidatePath('/resumo')
  revalidatePath('/historico')
}
