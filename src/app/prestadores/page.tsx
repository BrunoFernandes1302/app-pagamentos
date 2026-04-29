import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PrestadoresList from './prestadores-list'

export default async function PrestadoresPage() {
  const supabase = await createClient()
  const { data: prestadores, error } = await supabase
    .from('prestadores')
    .select('*')
    .order('nome')

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
          <span className="text-sm font-medium text-foreground">Prestadores</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-fit rounded-lg p-3 bg-orange-500/10">
            <Users className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Prestadores</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre, edite e remova prestadores de serviço
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Erro ao carregar dados: {error.message}
          </div>
        ) : (
          <PrestadoresList prestadores={prestadores ?? []} />
        )}
      </main>
    </div>
  )
}
