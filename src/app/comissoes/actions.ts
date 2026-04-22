'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MoedaSimples } from '@/lib/types'

interface PrestadorComissaoInput {
  prestador_id: string
  percentual: number
  moeda_recebimento: MoedaSimples
}

interface CriarComissaoInput {
  tipo: string
  descricao: string
  moeda_venda: MoedaSimples
  receita_ether: number
  previsao_pagamento: string | null
  prestadores: PrestadorComissaoInput[]
}

export async function criarComissao(input: CriarComissaoInput) {
  const supabase = await createClient()

  const { data: comissao, error: errComissao } = await supabase
    .from('comissoes')
    .insert({
      tipo: input.tipo,
      descricao: input.descricao,
      moeda_venda: input.moeda_venda,
      receita_ether: input.receita_ether,
      previsao_pagamento: input.previsao_pagamento,
    })
    .select('id')
    .single()

  if (errComissao) throw new Error(errComissao.message)

  const { error: errPrestadores } = await supabase
    .from('comissao_prestadores')
    .insert(input.prestadores.map(p => ({ comissao_id: comissao.id, ...p })))

  if (errPrestadores) {
    await supabase.from('comissoes').delete().eq('id', comissao.id)
    throw new Error(errPrestadores.message)
  }

  revalidatePath('/comissoes')
}

export async function atualizarComissao(id: string, input: CriarComissaoInput) {
  const supabase = await createClient()

  const { error: errComissao } = await supabase
    .from('comissoes')
    .update({
      tipo: input.tipo,
      descricao: input.descricao,
      moeda_venda: input.moeda_venda,
      receita_ether: input.receita_ether,
      previsao_pagamento: input.previsao_pagamento,
    })
    .eq('id', id)

  if (errComissao) throw new Error(errComissao.message)

  const { error: errDelete } = await supabase
    .from('comissao_prestadores')
    .delete()
    .eq('comissao_id', id)

  if (errDelete) throw new Error(errDelete.message)

  const { error: errInsert } = await supabase
    .from('comissao_prestadores')
    .insert(input.prestadores.map(p => ({ comissao_id: id, ...p })))

  if (errInsert) throw new Error(errInsert.message)

  revalidatePath('/comissoes')
}

export async function excluirComissao(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('comissoes').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/comissoes')
}

interface RegistrarPagamentoInput {
  cpId: string
  comissaoId: string
  prestadorId: string
  prestadorNome: string
  tipo: string
  descricaoComissao: string
  valor: number
  moeda: MoedaSimples
  comprovante: string | null
  mesReferencia: string
}

export async function registrarPagamentoComissao(input: RegistrarPagamentoInput) {
  const supabase = await createClient()

  const descricao = `Comissão: ${input.tipo} — ${input.descricaoComissao}`

  const { error: errHistorico } = await supabase
    .from('historico_pagamentos')
    .insert({
      tipo: 'comissao',
      referencia_id: input.comissaoId,
      comissao_prestador_id: input.cpId,
      prestador_id: input.prestadorId,
      prestador_nome: input.prestadorNome,
      descricao,
      valor: input.valor,
      moeda: input.moeda,
      comprovante: input.comprovante,
      mes_referencia: input.mesReferencia,
    })

  if (errHistorico) throw new Error(errHistorico.message)

  const { error: errUpdate } = await supabase
    .from('comissao_prestadores')
    .update({ pago: true, valor_comissao: input.valor })
    .eq('id', input.cpId)

  if (errUpdate) throw new Error(errUpdate.message)

  revalidatePath('/comissoes')
  revalidatePath('/historico')
}
