'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
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
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { data: comissao, error: errComissao } = await supabase
    .from('comissoes')
    .insert({
      tipo: input.tipo,
      descricao: input.descricao,
      moeda_venda: input.moeda_venda,
      receita_ether: input.receita_ether,
      previsao_pagamento: input.previsao_pagamento,
      organization_id: orgId,
    })
    .select('id')
    .single()

  if (errComissao) throw new Error('Erro ao criar comissão.')

  const { error: errPrestadores } = await supabase
    .from('comissao_prestadores')
    .insert(
      input.prestadores.map((p) => ({
        comissao_id: comissao.id,
        organization_id: orgId,
        ...p,
      })),
    )

  if (errPrestadores) {
    await supabase.from('comissoes').delete().eq('id', comissao.id)
    throw new Error('Erro ao associar prestadores à comissão.')
  }

  revalidatePath('/comissoes')
}

export async function atualizarComissao(id: string, input: CriarComissaoInput) {
  const orgId = await getOrganizationId()
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
    .eq('organization_id', orgId)

  if (errComissao) throw new Error('Erro ao atualizar comissão.')

  const { error: errDelete } = await supabase
    .from('comissao_prestadores')
    .delete()
    .eq('comissao_id', id)
    .eq('organization_id', orgId)

  if (errDelete) throw new Error('Erro ao atualizar comissão.')

  const { error: errInsert } = await supabase
    .from('comissao_prestadores')
    .insert(
      input.prestadores.map((p) => ({
        comissao_id: id,
        organization_id: orgId,
        ...p,
      })),
    )

  if (errInsert) throw new Error('Erro ao atualizar comissão.')

  revalidatePath('/comissoes')
}

export async function excluirComissao(id: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('comissoes')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao excluir comissão.')
  revalidatePath('/comissoes')
}

export async function atualizarNotaFiscalComissao(cpId: string, enviada: boolean) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('comissao_prestadores')
    .update({ nota_fiscal: enviada })
    .eq('id', cpId)
    .eq('organization_id', orgId)

  if (error) throw new Error('Erro ao atualizar nota fiscal.')
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
  notaFiscal: boolean
}

export async function registrarPagamentoComissao(input: RegistrarPagamentoInput) {
  const orgId = await getOrganizationId()
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
      nota_fiscal: input.notaFiscal,
      mes_referencia: input.mesReferencia,
      organization_id: orgId,
    })

  if (errHistorico) throw new Error('Erro ao registrar pagamento.')

  const { error: errUpdate } = await supabase
    .from('comissao_prestadores')
    .update({ pago: true, valor_comissao: input.valor })
    .eq('id', input.cpId)
    .eq('organization_id', orgId)

  if (errUpdate) throw new Error('Erro ao registrar pagamento.')

  revalidatePath('/comissoes')
  revalidatePath('/historico')
}
