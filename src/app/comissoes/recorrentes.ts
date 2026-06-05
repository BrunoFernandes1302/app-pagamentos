import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import { format } from 'date-fns'
import { calcularProximaApos } from '@/lib/recorrencia'

export async function aplicarRecorrentes() {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: templates } = await supabase
    .from('comissoes')
    .select(`
      id, tipo, descricao, moeda_venda, receita_ether,
      recorrencia_tipo, recorrencia_valor, proxima_recorrencia,
      comissao_prestadores(prestador_id, percentual, moeda_recebimento)
    `)
    .eq('organization_id', orgId)
    .eq('recorrente', true)
    .eq('recorrencia_ativa', true)
    .lte('proxima_recorrencia', today)

  for (const t of templates ?? []) {
    if (!t.recorrencia_tipo || t.recorrencia_valor === null || !t.proxima_recorrencia) continue

    const { data: nova } = await supabase
      .from('comissoes')
      .insert({
        tipo: t.tipo,
        descricao: t.descricao,
        moeda_venda: t.moeda_venda,
        receita_ether: t.receita_ether,
        previsao_pagamento: t.proxima_recorrencia,
        organization_id: orgId,
        recorrente: false,
        recorrencia_origem_id: t.id,
      })
      .select('id')
      .single()

    if (!nova) continue

    const prestadores = (t.comissao_prestadores ?? []) as {
      prestador_id: string
      percentual: number
      moeda_recebimento: string
    }[]

    if (prestadores.length > 0) {
      await supabase.from('comissao_prestadores').insert(
        prestadores.map(p => ({
          comissao_id: nova.id,
          organization_id: orgId,
          prestador_id: p.prestador_id,
          percentual: p.percentual,
          moeda_recebimento: p.moeda_recebimento,
        }))
      )
    }

    const proxima = calcularProximaApos(
      t.recorrencia_tipo as 'dia_mes' | 'dia_semana',
      t.recorrencia_valor,
      new Date(t.proxima_recorrencia)
    )

    await supabase
      .from('comissoes')
      .update({ proxima_recorrencia: proxima })
      .eq('id', t.id)
  }
}
