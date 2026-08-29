'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'

const BUCKET = 'comprovantes'
const MAX_PDF_BYTES = 5 * 1024 * 1024

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

export async function atualizarComprovanteArquivo(id: string, formData: FormData) {
  const file = formData.get('arquivo')
  if (!(file instanceof File)) throw new Error('Nenhum arquivo enviado.')
  if (file.type !== 'application/pdf') throw new Error('Apenas arquivos PDF são aceitos.')
  if (file.size > MAX_PDF_BYTES) throw new Error('O PDF deve ter no máximo 5 MB.')

  const bytes = await file.arrayBuffer()

  const orgId = await getOrganizationId()
  const supabase = await createClient()

  // Busca a linha e o arquivo atual (se houver) para substituir
  const { data: atual, error: errGet } = await supabase
    .from('historico_pagamentos')
    .select('id, comprovante_arquivo, organization_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (errGet || !atual) throw new Error('Pagamento não encontrado.')

  const path = objectPath(orgId, atual.id, file.name)

  const { error: errUpload } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: false })
  if (errUpload) throw new Error('Erro ao enviar o arquivo.')

  const { error: errUpdate } = await supabase
    .from('historico_pagamentos')
    .update({
      comprovante_arquivo: path,
      comprovante_arquivo_nome: file.name,
      comprovante_arquivo_tamanho: file.size,
    })
    .eq('id', atual.id)
    .eq('organization_id', orgId)
  if (errUpdate) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error('Erro ao salvar o comprovante.')
  }

  // Remove o arquivo anterior após o novo estar salvo
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
