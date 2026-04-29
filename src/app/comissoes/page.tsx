import Link from 'next/link'
import { ArrowLeft, Percent } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import ComissoesList from './comissoes-list'

export default async function ComissoesPage() {
  const supabase = await createClient()
  const orgId = await getOrganizationId()

  const [comissoesRes, prestadoresRes] = await Promise.all([
    supabase
      .from('comissoes')
      .select(`
        *,
        comissao_prestadores (
          *,
          prestadores ( nome, carteira_cripto, rede_cripto, chave_pix )
        )
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('prestadores')
      .select('id, nome, carteira_cripto, rede_cripto, chave_pix')
      .eq('organization_id', orgId)
      .eq('ativo', true)
      .order('nome'),
  ])

  const error = comissoesRes.error || prestadoresRes.error

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
          />
        )}
      </main>
    </div>
  )
}
