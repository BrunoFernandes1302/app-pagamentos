'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import { addMonths, format, parseISO } from 'date-fns'

export async function criarEmprestimo(data: {
  prestador_id: string
  valor_total: number
  numero_parcelas: number
  moeda: 'BRL' | 'USDT' | 'USDC'
  mes_inicio: string
  modo_multiplos?: 'sequencial' | 'acumulado'
  emprestimo_ativo_id?: string
  observacoes?: string
}) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  let mesInicio: Date

  if (data.modo_multiplos === 'sequencial' && data.emprestimo_ativo_id) {
    const { data: ultima } = await supabase
      .from('parcelas_emprestimo')
      .select('mes_referencia')
      .eq('emprestimo_id', data.emprestimo_ativo_id)
      .in('status', ['pendente', 'adiantada'])
      .order('mes_referencia', { ascending: false })
      .limit(1)
      .single()

    mesInicio = ultima
      ? addMonths(parseISO(ultima.mes_referencia), 1)
      : parseISO(data.mes_inicio + '-01')
  } else {
    mesInicio = parseISO(data.mes_inicio + '-01')
  }

  const valorParcela = parseFloat((data.valor_total / data.numero_parcelas).toFixed(2))

  const { data: emp, error } = await supabase
    .from('emprestimos')
    .insert({
      prestador_id: data.prestador_id,
      valor_total: data.valor_total,
      numero_parcelas: data.numero_parcelas,
      valor_parcela: valorParcela,
      moeda: data.moeda,
      mes_inicio: format(mesInicio, 'yyyy-MM-dd'),
      status: 'ativo',
      observacoes: data.observacoes || null,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error || !emp) throw new Error('Erro ao criar empréstimo.')

  const parcelas = Array.from({ length: data.numero_parcelas }, (_, i) => ({
    emprestimo_id: emp.id,
    numero_parcela: i + 1,
    valor: valorParcela,
    moeda: data.moeda,
    mes_referencia: format(addMonths(mesInicio, i), 'yyyy-MM-dd'),
    status: 'pendente' as const,
    organization_id: orgId,
  }))

  const { error: erroParc } = await supabase.from('parcelas_emprestimo').insert(parcelas)
  if (erroParc) throw new Error('Erro ao criar parcelas.')

  revalidatePath('/emprestimos')
}

export async function atualizarMesParcela(parcelaId: string, mesReferencia: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('parcelas_emprestimo')
    .update({ mes_referencia: mesReferencia })
    .eq('id', parcelaId)
    .eq('status', 'pendente')
    .eq('organization_id', orgId)

  if (error) throw new Error('Erro ao atualizar data da parcela.')
  revalidatePath('/emprestimos')
  revalidatePath('/resumo')
}

export async function reagendarParcelas(emprestimoId: string, novoMesInicio: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { data: pendentes, error } = await supabase
    .from('parcelas_emprestimo')
    .select('id, numero_parcela')
    .eq('emprestimo_id', emprestimoId)
    .eq('status', 'pendente')
    .eq('organization_id', orgId)
    .order('numero_parcela', { ascending: true })

  if (error || !pendentes || pendentes.length === 0) throw new Error('Nenhuma parcela pendente.')

  const inicio = parseISO(novoMesInicio)

  for (let i = 0; i < pendentes.length; i++) {
    const { error: e } = await supabase
      .from('parcelas_emprestimo')
      .update({ mes_referencia: format(addMonths(inicio, i), 'yyyy-MM-dd') })
      .eq('id', pendentes[i].id)
      .eq('organization_id', orgId)
    if (e) throw new Error('Erro ao reagendar parcela.')
  }

  revalidatePath('/emprestimos')
  revalidatePath('/resumo')
}

export async function cancelarEmprestimo(id: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('emprestimos')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao cancelar empréstimo.')
  revalidatePath('/emprestimos')
}

export async function reativarEmprestimo(id: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('emprestimos')
    .update({ status: 'ativo' })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao reativar empréstimo.')
  revalidatePath('/emprestimos')
}

export async function excluirEmprestimo(id: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('emprestimos')
    .delete()
    .eq('id', id)
    .in('status', ['cancelado', 'quitado'])
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao excluir empréstimo.')
  revalidatePath('/emprestimos')
}

export async function pagarParcela(parcelaId: string, emprestimoId: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('parcelas_emprestimo')
    .update({
      status: 'paga',
      tipo_pagamento: 'desconto_normal',
      data_pagamento: new Date().toISOString(),
    })
    .eq('id', parcelaId)
    .eq('organization_id', orgId)

  if (error) throw new Error('Erro ao pagar parcela.')

  const { data: pendentes } = await supabase
    .from('parcelas_emprestimo')
    .select('id')
    .eq('emprestimo_id', emprestimoId)
    .eq('status', 'pendente')

  if (!pendentes || pendentes.length === 0) {
    await supabase
      .from('emprestimos')
      .update({ status: 'quitado' })
      .eq('id', emprestimoId)
      .eq('organization_id', orgId)
  }

  revalidatePath('/emprestimos')
}

export async function adiantarParcela(emprestimoId: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { data: proxima } = await supabase
    .from('parcelas_emprestimo')
    .select('id')
    .eq('emprestimo_id', emprestimoId)
    .eq('status', 'pendente')
    .order('mes_referencia', { ascending: true })
    .limit(1)
    .single()

  if (!proxima) throw new Error('Nenhuma parcela pendente.')

  const hoje = new Date()
  const mesAtual = format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), 'yyyy-MM-dd')

  const { error } = await supabase
    .from('parcelas_emprestimo')
    .update({
      status: 'adiantada',
      tipo_pagamento: 'adiantamento',
      mes_referencia: mesAtual,
    })
    .eq('id', proxima.id)
    .eq('organization_id', orgId)

  if (error) throw new Error('Erro ao adiantar parcela.')

  revalidatePath('/emprestimos')
}

export async function pagamentoAvulso(emprestimoId: string, quantidade: number) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { data: parcelas } = await supabase
    .from('parcelas_emprestimo')
    .select('id')
    .eq('emprestimo_id', emprestimoId)
    .eq('status', 'pendente')
    .order('numero_parcela', { ascending: false })
    .limit(quantidade)

  if (!parcelas || parcelas.length === 0) throw new Error('Nenhuma parcela pendente.')

  const { error } = await supabase
    .from('parcelas_emprestimo')
    .update({
      status: 'quitada_avulso',
      tipo_pagamento: 'pagamento_avulso',
      data_pagamento: new Date().toISOString(),
    })
    .in('id', parcelas.map((p) => p.id))
    .eq('organization_id', orgId)

  if (error) throw new Error('Erro ao registrar pagamento avulso.')

  const { data: pendentes } = await supabase
    .from('parcelas_emprestimo')
    .select('id')
    .eq('emprestimo_id', emprestimoId)
    .eq('status', 'pendente')

  if (!pendentes || pendentes.length === 0) {
    await supabase
      .from('emprestimos')
      .update({ status: 'quitado' })
      .eq('id', emprestimoId)
      .eq('organization_id', orgId)
  }

  revalidatePath('/emprestimos')
}
