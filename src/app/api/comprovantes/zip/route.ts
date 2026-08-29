import { NextResponse, type NextRequest } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function sanitizar(s: string) {
  return s.replace(/[^a-zA-Z0-9À-ÿ._-]/g, '_').replace(/_+/g, '_')
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse(null, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return new NextResponse(null, { status: 403 })

  const sp = request.nextUrl.searchParams
  const mes = sp.get('mes')            // 'YYYY-MM' (opcional)
  const prestadorId = sp.get('prestador') // uuid (opcional)

  if (mes && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    return NextResponse.json({ error: 'Mês inválido.' }, { status: 400 })
  }

  let query = supabase
    .from('historico_pagamentos')
    .select('id, prestador_nome, descricao, pago_em, mes_referencia, comprovante_arquivo, comprovante_arquivo_nome')
    .eq('organization_id', profile.organization_id)
    .not('comprovante_arquivo', 'is', null)

  if (mes) query = query.eq('mes_referencia', `${mes}-01`)
  if (prestadorId) query = query.eq('prestador_id', prestadorId)

  const { data: pagamentos, error } = await query.order('pago_em', { ascending: false })

  if (error) return NextResponse.json({ error: 'Erro ao buscar comprovantes.' }, { status: 500 })
  if (!pagamentos || pagamentos.length === 0) {
    return NextResponse.json({ error: 'Nenhum comprovante encontrado para esses filtros.' }, { status: 404 })
  }

  const admin = createAdminClient()
  const zip = new JSZip()
  const usados = new Set<string>()
  let incluidos = 0

  for (const p of pagamentos) {
    if (!p.comprovante_arquivo) continue

    const { data: arquivo } = await admin.storage
      .from('comprovantes')
      .download(p.comprovante_arquivo)

    if (!arquivo) continue

    // Nome legível: Prestador_AAAA-MM_id.pdf (id evita colisão entre pagamentos do mesmo mês)
    const mesRef = (p.mes_referencia ?? '').substring(0, 7)
    let nome = `${sanitizar(p.prestador_nome)}_${mesRef}_${p.id.slice(0, 8)}.pdf`
    while (usados.has(nome)) nome = `${nome.replace(/\.pdf$/, '')}_1.pdf`
    usados.add(nome)

    zip.file(nome, await arquivo.arrayBuffer())
    incluidos++
  }

  if (incluidos === 0) {
    return NextResponse.json({ error: 'Não foi possível baixar os comprovantes.' }, { status: 404 })
  }

  const conteudo = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })

  const partes = ['comprovantes']
  if (prestadorId) partes.push(sanitizar(pagamentos[0].prestador_nome))
  if (mes) partes.push(mes)
  const nomeZip = `${partes.join('_')}.zip`

  return new NextResponse(conteudo as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nomeZip}"`,
      'Content-Length': String(conteudo.byteLength),
    },
  })
}