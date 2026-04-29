import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import Link from 'next/link'
import { ArrowLeft, Landmark } from 'lucide-react'
import EmprestimosList from './emprestimos-list'

export default async function EmprestimosPage() {
  const supabase = await createClient()
  const orgId = await getOrganizationId()

  const [{ data: emprestimos, error }, { data: prestadores }] = await Promise.all([
    supabase
      .from('emprestimos')
      .select('*, prestadores(nome), parcelas_emprestimo(*)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('prestadores')
      .select('id, nome')
      .eq('organization_id', orgId)
      .eq('ativo', true)
      .order('nome'),
  ])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Erro ao carregar empréstimos.</p>
      </div>
    )
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
          <span className="text-sm font-medium text-foreground">Empréstimos</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-fit rounded-lg p-3 bg-blue-500/10">
            <Landmark className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Empréstimos</h1>
            <p className="text-sm text-muted-foreground">
              Controle de empréstimos e adiantamentos aos prestadores
            </p>
          </div>
        </div>

        <EmprestimosList
          emprestimos={emprestimos ?? []}
          prestadores={prestadores ?? []}
        />
      </main>
    </div>
  )
}
