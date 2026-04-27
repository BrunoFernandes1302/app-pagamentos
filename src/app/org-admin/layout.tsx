import Link from 'next/link'
import { requireOrgAdmin } from '@/lib/auth'
import { LayoutDashboard, Users } from 'lucide-react'

export default async function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  await requireOrgAdmin()

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Administração</p>
            <h1 className="text-lg font-semibold text-foreground">Gerenciar Organização</h1>
          </div>
          <nav className="flex items-center gap-1 ml-4">
            <Link
              href="/org-admin"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Users className="h-4 w-4" />
              Usuários
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Voltar ao sistema
            </Link>
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  )
}
