'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { MoedaSimples } from '@/lib/types'
import { addMonths, addWeeks, format } from 'date-fns'
import { randomUUID } from 'crypto'

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

// ─── Helpers ───────────────────────────────────────────────────────────────

function calcularProximaOcorrencia(tipo: 'dia_mes' | 'dia_semana', valor: number): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (tipo === 'dia_mes') {
    let d = new Date(today.getFullYear(), today.getMonth(), valor)
    if (d <= today) d = new Date(today.getFullYear(), today.getMonth() + 1, valor)
    return format(d, 'yyyy-MM-dd')
  } else {
    const currentDay = today.getDay()
    let daysUntil = (valor - currentDay + 7) % 7
    if (daysUntil === 0) daysUntil = 7
    const d = new Date(today)
    d.setDate(d.getDate() + daysUntil)
    return format(d, 'yyyy-MM-dd')
  }
}

function calcularProximaApos(tipo: 'dia_mes' | 'dia_semana', valor: number, apos: Date): string {
  const d = new Date(apos)
  d.setHours(0, 0, 0, 0)
  if (tipo === 'dia_mes') {
    let next = new Date(d.getFullYear(), d.getMonth(), valor)
    if (next <= d) next = new Date(d.getFullYear(), d.getMonth() + 1, valor)
    return format(next, 'yyyy-MM-dd')
  } else {
    const currentDay = d.getDay()
    let daysUntil = (valor - currentDay + 7) % 7
    if (daysUntil === 0) daysUntil = 7
    const next = new Date(d)
    next.setDate(next.getDate() + daysUntil)
    return format(next, 'yyyy-MM-dd')
  }
}

// ─── Parcelada ─────────────────────────────────────────────────────────────

interface CriarComissaoParceladaInput extends CriarComissaoInput {
  totalParcelas: number
  intervalo: 'mensal' | 'semanal'
  dataInicio: string
}

export async function criarComissaoParcelada(input: CriarComissaoParceladaInput) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const grupoId = randomUUID()
  const base = new Date(input.dataInicio + 'T12:00:00')
  const receitaParcela = input.receita_ether / input.totalParcelas

  for (let i = 0; i < input.totalParcelas; i++) {
    const previsao = format(
      input.intervalo === 'mensal' ? addMonths(base, i) : addWeeks(base, i),
      'yyyy-MM-dd'
    )

    const { data: comissao, error } = await supabase
      .from('comissoes')
      .insert({
        tipo: input.tipo,
        descricao: input.descricao,
        moeda_venda: input.moeda_venda,
        receita_ether: receitaParcela,
        previsao_pagamento: previsao,
        organization_id: orgId,
        grupo_id: grupoId,
        parcela_num: i + 1,
        total_parcelas: input.totalParcelas,
      })
      .select('id')
      .single()

    if (error || !comissao) throw new Error('Erro ao criar parcela.')

    const { error: errP } = await supabase.from('comissao_prestadores').insert(
      input.prestadores.map(p => ({
        comissao_id: comissao.id,
        organization_id: orgId,
        ...p,
      }))
    )

    if (errP) throw new Error('Erro ao associar prestadores à parcela.')
  }

  revalidatePath('/comissoes')
}

// ─── Recorrente ────────────────────────────────────────────────────────────

interface CriarComissaoRecorrenteInput extends CriarComissaoInput {
  recorrenciaTipo: 'dia_mes' | 'dia_semana'
  recorrenciaValor: number
}

export async function criarComissaoRecorrente(input: CriarComissaoRecorrenteInput) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  // Primeira ocorrência → vira instância pagável imediatamente
  const primeiraOcorrencia = calcularProximaOcorrencia(input.recorrenciaTipo, input.recorrenciaValor)
  // Template guarda a SEGUNDA ocorrência como próxima
  const segundaOcorrencia = calcularProximaApos(
    input.recorrenciaTipo,
    input.recorrenciaValor,
    new Date(primeiraOcorrencia + 'T12:00:00'),
  )

  const { data: template, error } = await supabase
    .from('comissoes')
    .insert({
      tipo: input.tipo,
      descricao: input.descricao,
      moeda_venda: input.moeda_venda,
      receita_ether: input.receita_ether,
      previsao_pagamento: null,
      organization_id: orgId,
      recorrente: true,
      recorrencia_tipo: input.recorrenciaTipo,
      recorrencia_valor: input.recorrenciaValor,
      recorrencia_ativa: true,
      proxima_recorrencia: segundaOcorrencia,
    })
    .select('id')
    .single()

  if (error || !template) throw new Error('Erro ao criar comissão recorrente.')

  // Prestadores do template (para futuras ocorrências)
  const { error: errP } = await supabase.from('comissao_prestadores').insert(
    input.prestadores.map(p => ({ comissao_id: template.id, organization_id: orgId, ...p }))
  )

  if (errP) {
    await supabase.from('comissoes').delete().eq('id', template.id)
    throw new Error('Erro ao associar prestadores à comissão recorrente.')
  }

  // Cria a primeira instância pagável
  const { data: instancia } = await supabase
    .from('comissoes')
    .insert({
      tipo: input.tipo,
      descricao: input.descricao,
      moeda_venda: input.moeda_venda,
      receita_ether: input.receita_ether,
      previsao_pagamento: primeiraOcorrencia,
      organization_id: orgId,
      recorrente: false,
      recorrencia_origem_id: template.id,
    })
    .select('id')
    .single()

  if (instancia) {
    await supabase.from('comissao_prestadores').insert(
      input.prestadores.map(p => ({ comissao_id: instancia.id, organization_id: orgId, ...p }))
    )
  }

  revalidatePath('/comissoes')
}

export async function atualizarComissaoRecorrente(
  id: string,
  input: CriarComissaoRecorrenteInput,
) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const proxima = calcularProximaOcorrencia(input.recorrenciaTipo, input.recorrenciaValor)

  const { error } = await supabase
    .from('comissoes')
    .update({
      tipo: input.tipo,
      descricao: input.descricao,
      moeda_venda: input.moeda_venda,
      receita_ether: input.receita_ether,
      recorrencia_tipo: input.recorrenciaTipo,
      recorrencia_valor: input.recorrenciaValor,
      proxima_recorrencia: proxima,
    })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) throw new Error('Erro ao atualizar comissão recorrente.')

  await supabase.from('comissao_prestadores').delete().eq('comissao_id', id).eq('organization_id', orgId)
  await supabase.from('comissao_prestadores').insert(
    input.prestadores.map(p => ({ comissao_id: id, organization_id: orgId, ...p }))
  )

  revalidatePath('/comissoes')
}

// Gera a próxima instância de um template recorrente (uso interno)
async function _gerarProximaInstancia(templateId: string, orgId: string) {
  const supabase = await createClient()

  const { data: template } = await supabase
    .from('comissoes')
    .select('*, comissao_prestadores(prestador_id, percentual, moeda_recebimento)')
    .eq('id', templateId)
    .eq('organization_id', orgId)
    .single()

  if (
    !template ||
    !template.recorrencia_tipo ||
    template.recorrencia_valor === null ||
    !template.recorrencia_ativa
  ) return

  const previsao = template.proxima_recorrencia ?? calcularProximaOcorrencia(
    template.recorrencia_tipo as 'dia_mes' | 'dia_semana',
    template.recorrencia_valor,
  )

  const { data: instancia } = await supabase
    .from('comissoes')
    .insert({
      tipo: template.tipo,
      descricao: template.descricao,
      moeda_venda: template.moeda_venda,
      receita_ether: template.receita_ether,
      previsao_pagamento: previsao,
      organization_id: orgId,
      recorrente: false,
      recorrencia_origem_id: template.id,
    })
    .select('id')
    .single()

  if (!instancia) return

  const prestadores = (template.comissao_prestadores ?? []) as {
    prestador_id: string; percentual: number; moeda_recebimento: string
  }[]

  if (prestadores.length > 0) {
    await supabase.from('comissao_prestadores').insert(
      prestadores.map(p => ({ comissao_id: instancia.id, organization_id: orgId, ...p }))
    )
  }

  const proxima = calcularProximaApos(
    template.recorrencia_tipo as 'dia_mes' | 'dia_semana',
    template.recorrencia_valor,
    new Date(previsao + 'T12:00:00'),
  )
  await supabase.from('comissoes').update({ proxima_recorrencia: proxima }).eq('id', templateId)
}

export async function gerarInstanciaAgora(templateId: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  // Valida que o template existe e é recorrente
  const { data: template } = await supabase
    .from('comissoes')
    .select('recorrencia_tipo, recorrencia_valor')
    .eq('id', templateId)
    .eq('organization_id', orgId)
    .single()

  if (!template?.recorrencia_tipo) throw new Error('Template inválido.')

  await _gerarProximaInstancia(templateId, orgId)
  revalidatePath('/comissoes')
}

export async function encerrarRecorrencia(id: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('comissoes')
    .update({ recorrencia_ativa: false })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) throw new Error('Erro ao encerrar recorrência.')
  revalidatePath('/comissoes')
}

// ─── Pagamento ─────────────────────────────────────────────────────────────

export async function registrarPagamentoComissao(input: RegistrarPagamentoInput) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const descricao = `Comissão: ${input.tipo} — ${input.descricaoComissao}`

  const { data, error: errHistorico } = await supabase
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
    .select('id')
    .single()

  if (errHistorico) throw new Error('Erro ao registrar pagamento.')
  const historicoId = data.id

  const { error: errUpdate } = await supabase
    .from('comissao_prestadores')
    .update({ pago: true, valor_comissao: input.valor })
    .eq('id', input.cpId)
    .eq('organization_id', orgId)

  if (errUpdate) throw new Error('Erro ao registrar pagamento.')

  // Se for instância recorrente e todos os prestadores agora estão pagos → gera próxima
  const { data: instancia } = await supabase
    .from('comissoes')
    .select('recorrencia_origem_id, comissao_prestadores(id, pago)')
    .eq('id', input.comissaoId)
    .single()

  if (instancia?.recorrencia_origem_id) {
    const todosPageos = (instancia.comissao_prestadores ?? []).every(
      (cp: { id: string; pago: boolean }) => cp.id === input.cpId ? true : cp.pago
    )
    if (todosPageos) {
      await _gerarProximaInstancia(instancia.recorrencia_origem_id, orgId)
    }
  }

  revalidatePath('/comissoes')
  revalidatePath('/historico')

  return { historicoId }
}
