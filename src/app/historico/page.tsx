import Link from 'next/link'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { HistoricoPagamento, MoedaSimples } from '@/lib/types'
import MesSelector from './mes-selector'
import ComprovanteEditor from './comprovante-editor'
import PagoEmEditor from './pago-em-editor'
import DeletePagamento from './delete-pagamento'
import NfEditor from './nf-editor'
import EmailStatusEditor from './email-status-editor'
import EmailVbaDialog from './email-vba-dialog'
import type { HistoricoParaEmail } from './email-vba-dialog'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function getMesAtual() {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

function validarMes(mes: string | undefined): string {
  if (!mes) return getMesAtual()
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return mes
  return getMesAtual()
}

function formatValor(valor: number, moeda: MoedaSimples) {
  if (moeda !== 'BRL')
    return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${moeda}`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function ResumoCard({ label, valor, moeda, count }: {
  label: string
  valor: number
  moeda: MoedaSimples
  count: number
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
        {moeda !== 'BRL'
          ? `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${moeda}`
          : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{count} pagamento{count !== 1 ? 's' : ''}</p>
    </div>
  )
}

function PagamentoCard({ p }: { p: HistoricoPagamento }) {
  const isComissao = p.tipo === 'comissao'

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 border-b border-border gap-4">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isComissao
              ? 'bg-emerald-500/100/15 text-emerald-300'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {isComissao ? 'Comissão' : 'Salário'}
          </span>
          <span className="font-semibold text-foreground">{p.prestador_nome}</span>
          <PagoEmEditor id={p.id} pagoEm={p.pago_em} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold tabular-nums text-foreground">
            {formatValor(p.valor, p.moeda)}
          </span>
          <DeletePagamento id={p.id} tipo={p.tipo} comissaoPrestadorId={p.comissao_prestador_id} />
        </div>
      </div>

      <div className="px-5 py-3 space-y-2">
        <p className="text-sm text-muted-foreground">{p.descricao}</p>
        <ComprovanteEditor id={p.id} comprovante={p.comprovante} moeda={p.moeda} />
        <NfEditor id={p.id} notaFiscal={p.nota_fiscal} />
        {p.moeda !== 'BRL' && <EmailStatusEditor id={p.id} emailEnviado={p.email_enviado} />}
      </div>
    </div>
  )
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes } = await searchParams
  const mesAtual = validarMes(mes)
  const mesReferencia = `${mesAtual}-01`

  const [anoNum, mesNum] = mesAtual.split('-').map(Number)
  const nomeMes = `${MESES[mesNum - 1]} ${anoNum}`

  const supabase = await createClient()
  const { data: pagamentos, error } = await supabase
    .from('historico_pagamentos')
    .select('*, prestadores(email)')
    .eq('mes_referencia', mesReferencia)
    .order('pago_em', { ascending: false })

  const lista: HistoricoPagamento[] = (pagamentos ?? []) as HistoricoPagamento[]

  const pagamentosEmail: HistoricoParaEmail[] = (pagamentos ?? [])
    .filter(p => p.moeda !== 'BRL' && p.comprovante && !p.email_enviado)
    .map(p => ({
      id: p.id,
      tipo: p.tipo,
      prestador_nome: p.prestador_nome,
      prestador_email: (p.prestadores as { email: string } | null)?.email ?? null,
      descricao: p.descricao,
      valor: p.valor,
      comprovante: p.comprovante!,
      mes_referencia: p.mes_referencia,
    }))

  const comissoes = lista.filter(p => p.tipo === 'comissao')
  const salarios = lista.filter(p => p.tipo === 'salario')

  const comissaoUsdtItems = comissoes.filter(p => p.moeda === 'USDT')
  const comissaoUsdcItems = comissoes.filter(p => p.moeda === 'USDC')
  const comissaoTotalUsdt = comissaoUsdtItems.reduce((s, p) => s + p.valor, 0)
  const comissaoTotalUsdc = comissaoUsdcItems.reduce((s, p) => s + p.valor, 0)
  const comissaoTotalBrl = comissoes.filter(p => p.moeda === 'BRL').reduce((s, p) => s + p.valor, 0)
  const comissaoCountUsdt = comissaoUsdtItems.length
  const comissaoCountUsdc = comissaoUsdcItems.length
  const comissaoCountBrl = comissoes.filter(p => p.moeda === 'BRL').length

  const salarioUsdtItems = salarios.filter(p => p.moeda === 'USDT')
  const salarioUsdcItems = salarios.filter(p => p.moeda === 'USDC')
  const salarioTotalUsdt = salarioUsdtItems.reduce((s, p) => s + p.valor, 0)
  const salarioTotalUsdc = salarioUsdcItems.reduce((s, p) => s + p.valor, 0)
  const salarioTotalBrl = salarios.filter(p => p.moeda === 'BRL').reduce((s, p) => s + p.valor, 0)
  const salarioCountUsdt = salarioUsdtItems.length
  const salarioCountUsdc = salarioUsdcItems.length
  const salarioCountBrl = salarios.filter(p => p.moeda === 'BRL').length

  const temResumoComissoes = comissaoCountUsdt > 0 || comissaoCountUsdc > 0 || comissaoCountBrl > 0
  const temResumoSalarios = salarioCountUsdt > 0 || salarioCountUsdc > 0 || salarioCountBrl > 0

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-5">
        <div className="mx-auto max-w-5xl flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Início
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">Histórico</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Título + seletor */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-fit rounded-lg p-3 bg-slate-500/10">
              <CalendarDays className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Histórico de Pagamentos</h1>
              <p className="text-sm text-muted-foreground">{nomeMes}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <EmailVbaDialog pagamentos={pagamentosEmail} />
            <MesSelector mesAtual={mesAtual} />
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Erro ao carregar dados: {error.message}
          </div>
        ) : (
          <>
            {/* Resumo do mês — separado por tipo */}
            {(temResumoComissoes || temResumoSalarios) && (
              <div className="space-y-4 mb-8">
                {temResumoComissoes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Comissões
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {comissaoCountUsdt > 0 && (
                        <ResumoCard label="Total USDT" valor={comissaoTotalUsdt} moeda="USDT" count={comissaoCountUsdt} />
                      )}
                      {comissaoCountUsdc > 0 && (
                        <ResumoCard label="Total USDC" valor={comissaoTotalUsdc} moeda="USDC" count={comissaoCountUsdc} />
                      )}
                      {comissaoCountBrl > 0 && (
                        <ResumoCard label="Total BRL" valor={comissaoTotalBrl} moeda="BRL" count={comissaoCountBrl} />
                      )}
                    </div>
                  </div>
                )}
                {temResumoSalarios && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Salários
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {salarioCountUsdt > 0 && (
                        <ResumoCard label="Total USDT" valor={salarioTotalUsdt} moeda="USDT" count={salarioCountUsdt} />
                      )}
                      {salarioCountUsdc > 0 && (
                        <ResumoCard label="Total USDC" valor={salarioTotalUsdc} moeda="USDC" count={salarioCountUsdc} />
                      )}
                      {salarioCountBrl > 0 && (
                        <ResumoCard label="Total BRL" valor={salarioTotalBrl} moeda="BRL" count={salarioCountBrl} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lista vazia */}
            {lista.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-16 text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhum pagamento registrado em {nomeMes}.
                </p>
              </div>
            )}

            {/* Comissões */}
            {comissoes.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Comissões ({comissoes.length})
                </h2>
                <div className="space-y-3">
                  {comissoes.map(p => <PagamentoCard key={p.id} p={p} />)}
                </div>
              </section>
            )}

            {/* Salários */}
            {salarios.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Salários ({salarios.length})
                </h2>
                <div className="space-y-3">
                  {salarios.map(p => <PagamentoCard key={p.id} p={p} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
