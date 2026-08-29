import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse(null, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return new NextResponse(null, { status: 403 })

  const { data: pagamento } = await supabase
    .from('historico_pagamentos')
    .select('comprovante_arquivo, comprovante_arquivo_nome, organization_id')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!pagamento || pagamento.organization_id !== profile.organization_id) {
    return new NextResponse(null, { status: 403 })
  }

  if (!pagamento.comprovante_arquivo) return new NextResponse(null, { status: 404 })

  const sp = request.nextUrl.searchParams
  const baixar = sp.get('download') === '1'

  // O fluxo de email (VBA) precisa de um nome previsível para anexar o arquivo do disco
  const nomeArquivo = sp.get('nomefixo') === '1'
    ? `comprovante-${id}.pdf`
    : pagamento.comprovante_arquivo_nome ?? 'comprovante.pdf'

  // Bucket privado: o download exige token assinado (service role)
  const admin = createAdminClient()
  const { data } = await admin.storage
    .from('comprovantes')
    .createSignedUrl(
      pagamento.comprovante_arquivo,
      60,
      baixar ? { download: nomeArquivo } : undefined,
    )

  if (!data?.signedUrl) return new NextResponse(null, { status: 404 })

  // O client pede ?json=1 para abrir a URL do Supabase direto numa aba nova.
  // Navegar para esta rota (mesma origem) faz o Chrome capturar o link em PWAs instalados.
  if (sp.get('json') === '1') {
    return NextResponse.json({ url: data.signedUrl, nomeArquivo })
  }

  return NextResponse.redirect(data.signedUrl, { status: 307 })
}