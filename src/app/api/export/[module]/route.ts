import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toCsv } from '@/lib/csv'
import { addMonths, differenceInMonths, format, parseISO, startOfMonth, subMonths } from 'date-fns'

function csvResponse(name: string, rows: Record<string, unknown>[]) {
  const content = '﻿' + toCsv(rows)
  return new Response(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
    },
  })
}

function validarMes(mes: string | null): string {
  const now = format(startOfMonth(new Date()), 'yyyy-MM')
  if (!mes) return now
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : now
}

function fmtData(iso: string | null) {
  if (!iso) return ''
  try { return format(parseISO(iso), 'dd/MM/yyyy') } catch { return iso }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(null, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  const orgId = profile?.organization_id
  if (!orgId) return new Response(null, { status: 401 })

  const { module } = await params
  const sp = request.nextUrl.searchParams
  const mes = validarMes(sp.get('mes'))
  const mesDate = `${mes}-01`

  switch (module) {
    case 'prestadores': {
      const { data } = await supabase
        .from('prestadores')
        .select('*')
        .eq('organization_id', orgId)
        .order('nome')

      const rows = (data ?? []).map(p => ({
        'Nome': p.nome,
        'Email': p.email ?? '',
        'Setor': p.setor ?? '',
        'Função': p.funcao ?? '',
        'Contrato': p.contrato,
        'Salário Base': p.salario_base,
        'Tipo Chave PIX': p.tipo_chave_pix ?? '',
        'Chave PIX': p.chave_pix ?? '',
        'Carteira Cripto': p.carteira_cripto ?? '',
        'Rede Cripto': p.rede_cripto ?? '',
        'Ativo': p.ativo ? 'Sim' : 'Não',
        'Data Início': fmtData(p.data_inicio),
      }))
      return csvResponse(`prestadores_${format(new Date(), 'yyyy-MM-dd')}`, rows)
    }

    case 'comissoes': {
      const { data } = await supabase
        .from('comissoes')
        .select('*, comissao_prestadores(*, prestadores(nome))')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      const rows: Record<string, unknown>[] = []
      for (const c of data ?? []) {
        const prestadores = c.comissao_prestadores ?? []
        if (prestadores.length === 0) {
          rows.push({
            'Data': fmtData(c.created_at),
            'Tipo': c.tipo,
            'Descrição': c.descricao,
            'Receita Ether': c.receita_ether,
            'Moeda Venda': c.moeda_venda,
            'Previsão Pagamento': fmtData(c.previsao_pagamento),
            'Prestador': '',
            'Percentual (%)': '',
            'Valor Comissão': '',
            'Moeda Recebimento': '',
            'Pago': '',
            'Nota Fiscal': '',
          })
        } else {
          for (const cp of prestadores) {
            rows.push({
              'Data': fmtData(c.created_at),
              'Tipo': c.tipo,
              'Descrição': c.descricao,
              'Receita Ether': c.receita_ether,
              'Moeda Venda': c.moeda_venda,
              'Previsão Pagamento': fmtData(c.previsao_pagamento),
              'Prestador': cp.prestadores?.nome ?? '',
              'Percentual (%)': cp.percentual,
              'Valor Comissão': cp.valor_comissao ?? '',
              'Moeda Recebimento': cp.moeda_recebimento,
              'Pago': cp.pago ? 'Sim' : 'Não',
              'Nota Fiscal': cp.nota_fiscal ? 'Sim' : 'Não',
            })
          }
        }
      }
      return csvResponse(`comissoes_${format(new Date(), 'yyyy-MM-dd')}`, rows)
    }

    case 'emprestimos': {
      const { data } = await supabase
        .from('emprestimos')
        .select('*, prestadores(nome), parcelas_emprestimo(*)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      const rows = (data ?? []).map(e => {
        const parcelas: { status: string }[] = e.parcelas_emprestimo ?? []
        const pagas = parcelas.filter(p => p.status === 'paga' || p.status === 'quitada_avulso').length
        const pendentes = parcelas.filter(p => p.status === 'pendente' || p.status === 'adiantada').length
        return {
          'Prestador': (e.prestadores as { nome: string } | null)?.nome ?? '',
          'Valor Total': e.valor_total,
          'Nº Parcelas': e.numero_parcelas,
          'Valor Parcela': e.valor_parcela,
          'Moeda': e.moeda,
          'Mês Início': e.mes_inicio,
          'Status': e.status,
          'Parcelas Pagas': pagas,
          'Parcelas Pendentes': pendentes,
          'Observações': e.observacoes ?? '',
        }
      })
      return csvResponse(`emprestimos_${format(new Date(), 'yyyy-MM-dd')}`, rows)
    }

    case 'progressao-salarial': {
      const { data } = await supabase
        .from('progressao_salarial')
        .select('*, prestadores(nome, contrato)')
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })

      const rows = (data ?? []).map(p => ({
        'Prestador': (p.prestadores as { nome: string; contrato: string } | null)?.nome ?? '',
        'Contrato': (p.prestadores as { nome: string; contrato: string } | null)?.contrato ?? '',
        'Salário Inicial': p.salario_inicial,
        'Incremento': p.incremento,
        'Salário Alvo': p.salario_alvo,
        'Mês Início': p.mes_inicio,
        'Status': p.status,
      }))
      return csvResponse(`progressao_salarial_${format(new Date(), 'yyyy-MM-dd')}`, rows)
    }

    case 'resumo': {
      const mesFimDate = format(addMonths(parseISO(mesDate), 1), 'yyyy-MM-dd')
      const mesAnteriorStr = format(subMonths(parseISO(mesDate), 1), 'yyyy-MM-dd')

      // Busca cotação para conversão cross-currency (USDT/BRL)
      let rate: number | null = null
      try {
        const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL', { signal: AbortSignal.timeout(5000) })
        if (r.ok) rate = parseFloat((await r.json()).price)
      } catch { /* segue sem cotação */ }

      const [{ data: prestadores }, { data: empAtivos }, { data: pagosNoMes }, { data: progressoes }, { data: faltasDoMes }] = await Promise.all([
        supabase.from('prestadores').select('id, nome, contrato, cripto_moeda, salario_base').eq('organization_id', orgId).eq('ativo', true).lt('data_inicio', mesDate).order('nome'),
        supabase.from('emprestimos').select('id, prestador_id').eq('organization_id', orgId).eq('status', 'ativo'),
        supabase.from('historico_pagamentos').select('prestador_id').eq('tipo', 'salario').eq('mes_referencia', mesDate),
        supabase.from('progressao_salarial').select('prestador_id, salario_inicial, incremento, salario_alvo, mes_inicio').eq('status', 'ativo'),
        supabase.from('faltas').select('prestador_id').gte('data', mesAnteriorStr).lt('data', mesDate),
      ])

      const mesSelDate = parseISO(mesDate)
      const progressaoMap = new Map<string, number>()
      for (const prog of progressoes ?? []) {
        const n = differenceInMonths(mesSelDate, parseISO(prog.mes_inicio))
        const salario = n < 0
          ? prog.salario_inicial
          : Math.min(prog.salario_inicial + prog.incremento * (n + 1), prog.salario_alvo)
        progressaoMap.set(prog.prestador_id, salario)
      }

      const empIds = empAtivos?.map(e => e.id) ?? []
      let parcelasRaw: { emprestimo_id: string; valor: number; moeda: string }[] = []
      if (empIds.length > 0) {
        const { data } = await supabase
          .from('parcelas_emprestimo')
          .select('emprestimo_id, valor, moeda')
          .eq('mes_referencia', mesDate)
          .in('status', ['pendente', 'adiantada'])
          .in('emprestimo_id', empIds)
        parcelasRaw = data ?? []
      }

      const empMap = new Map(empAtivos?.map(e => [e.id, e.prestador_id]) ?? [])
      const parcelasMap = new Map<string, { valor: number; moeda: string }[]>()
      for (const p of parcelasRaw) {
        const prestadorId = empMap.get(p.emprestimo_id)
        if (!prestadorId) continue
        if (!parcelasMap.has(prestadorId)) parcelasMap.set(prestadorId, [])
        parcelasMap.get(prestadorId)!.push({ valor: p.valor, moeda: p.moeda })
      }

      const pagoSet = new Set((pagosNoMes ?? []).map(p => p.prestador_id).filter(Boolean) as string[])
      const faltasCount = new Map<string, number>()
      for (const f of faltasDoMes ?? []) {
        faltasCount.set(f.prestador_id, (faltasCount.get(f.prestador_id) ?? 0) + 1)
      }

      const rows = (prestadores ?? []).map(p => {
        const salario = progressaoMap.get(p.id) ?? p.salario_base
        const faltas = faltasCount.get(p.id) ?? 0
        const dias = Math.max(1, 30 - faltas)
        const parcelas = parcelasMap.get(p.id) ?? []

        const cripto = (p as { cripto_moeda?: string }).cripto_moeda ?? 'USDT'
        const base = p.contrato === 'USDT' ? cripto : 'BRL'
        const pagto = p.contrato === 'BRL' ? 'BRL' : cripto
        const converte = base !== pagto

        let deducao = 0
        for (const parc of parcelas) {
          if (parc.moeda === base) {
            deducao += parc.valor
          } else if (rate != null) {
            deducao += base === 'BRL' ? parc.valor * rate : parc.valor / rate
          }
        }

        const proporcional = (salario / 30) * dias
        const liquido = proporcional - deducao
        const pagamentoFinal = converte ? (rate != null ? liquido / rate : null) : liquido

        const fmt2 = (v: number) => parseFloat(v.toFixed(2))

        return {
          'Prestador': p.nome,
          'Contrato': p.contrato,
          'Salário Calculado': salario,
          'Faltas': faltas,
          'Dias Trabalhados': dias,
          'Salário Proporcional': fmt2(proporcional),
          'Desconto Total': deducao > 0 ? fmt2(deducao) : '',
          'Moeda Base': base,
          'Pagamento Final': pagamentoFinal != null ? fmt2(pagamentoFinal) : '',
          'Moeda Pagamento': pagto,
          'Cotação USD/BRL': (converte || parcelas.some(x => x.moeda !== base)) && rate ? parseFloat(rate.toFixed(4)) : '',
          'Pago': pagoSet.has(p.id) ? 'Sim' : 'Não',
        }
      })
      return csvResponse(`resumo_${mes}`, rows)
    }

    case 'historico': {
      const { data } = await supabase
        .from('historico_pagamentos')
        .select('*, prestadores(email)')
        .eq('mes_referencia', mesDate)
        .order('pago_em', { ascending: false })

      const rows = (data ?? []).map(p => ({
        'Data Pagamento': fmtData(p.pago_em),
        'Tipo': p.tipo === 'comissao' ? 'Comissão' : 'Salário',
        'Prestador': p.prestador_nome,
        'Email': (p.prestadores as { email: string } | null)?.email ?? '',
        'Descrição': p.descricao,
        'Valor': p.valor,
        'Moeda': p.moeda,
        'Comprovante': p.comprovante ?? '',
        'Nota Fiscal': p.nota_fiscal ? 'Sim' : 'Não',
        'Mês Referência': p.mes_referencia,
      }))
      return csvResponse(`historico_${mes}`, rows)
    }

    default:
      return new Response(null, { status: 404 })
  }
}
