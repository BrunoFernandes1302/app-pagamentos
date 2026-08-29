import Link from 'next/link'
import { ArrowLeft, Percent } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import ComissoesList from './comissoes-list'
import { aplicarRecorrentes } from './recorrentes'

export default async function ComissoesPage() {
  // Gera a próxima ocorrência de comissões recorrentes que já venceram
  try { await aplicarRecorrentes() } catch { /* segue sem bloquear */ }

  const supabase = await createClient()
  const orgId = await getOrganizationId()

  const [comissoesRes, prestadoresRes, historicoRes] = await Promise.all([
    supabase
      .from('comissoes')
      .select(`
        *,
        comissao_prestadores (
          *,
          prestadores ( nome, contrato, carteira_cripto, rede_cripto, cripto_moeda, chave_pix, tipo_chave_pix )
        )
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('prestadores')
      .select('id, nome, ativo, carteira_cripto, rede_cripto, cripto_moeda, chave_pix, tipo_chave_pix')
      .eq('organization_id', orgId)
      .order('nome'),
    supabase
      .from('historico_pagamentos')
      .select('id, comissao_prestador_id, comprovante_arquivo')
      .eq('organization_id', orgId)
      .not('comissao_prestador_id', 'is', null),
  ])

  const error = comissoesRes.error || prestadoresRes.error || historicoRes.error

  // Mapeia cada comissao_prestador pago ao seu histórico (para o link do PDF)
  const historicoPorCp: Record<string, { id: string; comprovante_arquivo: string | null }> = {}
  for (const h of historicoRes.data ?? []) {
    if (h.comissao_prestador_id && !historicoPorCp[h.comissao_prestador_id]) {
      historicoPorCp[h.comissao_prestador_id] = {
        id: h.id,
        comprovante_arquivo: h.comprovante_arquivo,
      }
    }
  }

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
          <span className="text-sm font-medium text-foreground">Comissões</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-fit rounded-lg p-3 bg-emerald-500/10">
            <Percent className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Comissões</h1>
            <p className="text-sm text-muted-foreground">
              Registre e acompanhe comissões dos prestadores
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Erro ao carregar dados: {error.message}
          </div>
        ) : (
          <ComissoesList
            comissoes={comissoesRes.data ?? []}
            prestadoresAtivos={prestadoresRes.data ?? []}
            historicoPorCp={historicoPorCp}
          />
        )}
      </main>
    </div>
  )
}
