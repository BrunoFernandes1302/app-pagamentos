import { UserCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgAdmin } from '@/lib/auth'
import { CriarUsuarioOrgForm } from './criar-usuario-form'
import { ExcluirUsuarioOrgBtn } from './excluir-usuario-btn'
import { EditarUsuarioOrgBtn } from './editar-usuario-btn'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  member: 'Membro',
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  admin:       'bg-violet-100 text-violet-700',
  member:      'bg-muted text-muted-foreground',
}

export default async function OrgAdminPage() {
  const profile = await requireOrgAdmin()
  const adminClient = createAdminClient()

  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, nome, role')
    .eq('organization_id', profile.organization_id)
    .order('nome')

  const users = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await adminClient.auth.admin.getUserById(p.id)
      return { ...p, email: data.user?.email ?? '' }
    }),
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Usuários da organização</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Crie usuários e gerencie quem tem acesso ao sistema nesta organização.
        </p>

        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-foreground mb-4">Novo usuário</p>
          <CriarUsuarioOrgForm />
        </div>

        {users.length > 0 ? (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                <UserCircle className="h-8 w-8 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{u.nome}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role] ?? 'bg-muted text-muted-foreground'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    {u.id === profile.id && (
                      <span className="rounded-full bg-slate-500/10 text-slate-400 px-2 py-0.5 text-xs">você</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                {u.id !== profile.id && u.role !== 'super_admin' && (
                  <div className="flex items-center gap-1">
                    <EditarUsuarioOrgBtn userId={u.id} nome={u.nome} role={u.role} />
                    <ExcluirUsuarioOrgBtn userId={u.id} nome={u.nome} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
        )}
      </div>
    </div>
  )
}
