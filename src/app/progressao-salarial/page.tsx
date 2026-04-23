import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ProgressaoList from './progressao-list'
import { aplicarProgressoes } from './actions'

export default async function ProgressaoSalarialPage() {
  await aplicarProgressoes()

  const supabase = await createClient()

  const [{ data: progressoes, error }, { data: prestadores }] = await Promise.all([
    supabase
      .from('progressao_salarial')
      .select('*, prestadores(nome, contrato)')
      .eq('status', 'ativo')
      .order('created_at', { ascending: false }),
    supabase
      .from('prestadores')
      .select('id, nome, contrato, salario_base')
      .eq('ativo', true)
      .order('nome'),
  ])

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
          <span className="text-sm font-medium text-foreground">Progressão Salarial</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-fit rounded-lg p-3 bg-violet-50">
            <TrendingUp className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Progressão Salarial</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe o aumento progressivo de salário dos prestadores
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Erro ao carregar dados: {error.message}
          </div>
        ) : (
          <ProgressaoList
            progressoes={progressoes ?? []}
            prestadores={prestadores ?? []}
          />
        )}
      </main>
    </div>
  )
}
