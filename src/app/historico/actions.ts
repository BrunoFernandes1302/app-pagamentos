'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import { MAX_PDF_BYTES, MAX_PDF_LABEL } from '@/lib/comprovante'

const BUCKET = 'comprovantes'

function sanitizarNomeArquivo(nome: string): string {
  const base = nome.replace(/\.pdf$/i, '')
  const limpo = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  return `${limpo || 'comprovante'}.pdf`
}

function objectPath(orgId: string, historicoId: string, nome: string) {
  return `${orgId}/${historicoId}/${randomUUID()}-${sanitizarNomeArquivo(nome)}`
}

export async function atualizarNotaFiscalHistorico(id: string, notaFiscal: boolean) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('historico_pagamentos')
    .update({ nota_fiscal: notaFiscal })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao atualizar nota fiscal.')
  revalidatePath('/historico')
}

export async function atualizarEmailEnviado(id: string, enviado: boolean) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('historico_pagamentos')
    .update({ email_enviado: enviado })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao atualizar status de email.')
  revalidatePath('/historico')
}

export async function marcarEmailsEnviados(ids: string[]) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('historico_pagamentos')
    .update({ email_enviado: true })
    .in('id', ids)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao marcar emails como enviados.')
  revalidatePath('/historico')
}

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

// O arquivo NÃO trafega por aqui: a Vercel corta requisições de Function acima
// de 4,5 MB, limite de infraestrutura que não é configurável. O browser envia o
// PDF direto ao Supabase com este token e depois chama confirmarComprovanteArquivo.
export async function criarUploadComprovante(id: string, nomeArquivo: string, tamanho: number) {
  if (tamanho > MAX_PDF_BYTES) throw new Error(`O PDF deve ter no máximo ${MAX_PDF_LABEL}.`)

  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { data: atual, error: errGet } = await supabase
    .from('historico_pagamentos')
    .select('id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (errGet || !atual) throw new Error('Pagamento não encontrado.')

  const path = objectPath(orgId, atual.id, nomeArquivo)

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw new Error('Erro ao preparar o envio do arquivo.')

  return { path, token: data.token }
}

export async function confirmarComprovanteArquivo(
  id: string,
  path: string,
  nomeArquivo: string,
  tamanho: number,
) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  // Impede que um path arbitrário seja gravado na linha
  if (!path.startsWith(`${orgId}/${id}/`)) throw new Error('Arquivo inválido.')

  const { data: atual, error: errGet } = await supabase
    .from('historico_pagamentos')
    .select('id, comprovante_arquivo')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (errGet || !atual) throw new Error('Pagamento não encontrado.')

  const { error: errUpdate } = await supabase
    .from('historico_pagamentos')
    .update({
      comprovante_arquivo: path,
      comprovante_arquivo_nome: nomeArquivo,
      comprovante_arquivo_tamanho: tamanho,
    })
    .eq('id', atual.id)
    .eq('organization_id', orgId)
  if (errUpdate) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error('Erro ao salvar o comprovante.')
  }

  if (atual.comprovante_arquivo && atual.comprovante_arquivo !== path) {
    await supabase.storage.from(BUCKET).remove([atual.comprovante_arquivo])
  }

  revalidatePath('/historico')
}

export async function removerComprovanteArquivo(id: string) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()

  const { data: atual, error: errGet } = await supabase
    .from('historico_pagamentos')
    .select('id, comprovante_arquivo, organization_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (errGet || !atual) throw new Error('Pagamento não encontrado.')

  if (atual.comprovante_arquivo) {
    await supabase.storage.from(BUCKET).remove([atual.comprovante_arquivo])
  }

  const { error } = await supabase
    .from('historico_pagamentos')
    .update({
      comprovante_arquivo: null,
      comprovante_arquivo_nome: null,
      comprovante_arquivo_tamanho: null,
    })
    .eq('id', atual.id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao remover o comprovante.')

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

export async function atualizarValor(id: string, valor: number) {
  const orgId = await getOrganizationId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('historico_pagamentos')
    .update({ valor })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error('Erro ao atualizar valor.')
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
