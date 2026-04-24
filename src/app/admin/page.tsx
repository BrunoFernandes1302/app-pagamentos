import { Building2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { CriarOrgForm } from './criar-org-form'
import { ExcluirOrgBtn } from './excluir-org-btn'

export default async function AdminPage() {
  const admin = createAdminClient()
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, nome, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Organizações</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Cada organização tem acesso isolado aos próprios dados.
        </p>

        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground mb-3">Nova organização</p>
          <CriarOrgForm />
        </div>

        {orgs && orgs.length > 0 ? (
          <div className="divide-y divide-border rounded-xl border border-border">
            {orgs.map((org) => (
              <div key={org.id} className="flex items-center gap-4 px-4 py-3">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{org.nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">{org.id}</p>
                </div>
                <ExcluirOrgBtn orgId={org.id} nome={org.nome} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma organização cadastrada.</p>
        )}
      </div>
    </div>
  )
}
