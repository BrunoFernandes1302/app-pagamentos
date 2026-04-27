import { UserCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CriarUsuarioForm } from './criar-usuario-form'
import { ExcluirUsuarioBtn } from './excluir-usuario-btn'
import { EditarUsuarioBtn } from './editar-usuario-btn'

type UserRow = {
  id: string
  email: string
  nome: string
  role: string
  organization_id: string
  org_nome: string
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  member: 'Membro',
}

export default async function UsuariosPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: orgs }, { data: users }] = await Promise.all([
    admin.from('organizations').select('id, nome').order('nome'),
    supabase.rpc('get_users_for_admin'),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Usuários</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Crie usuários e atribua a uma organização. Informe a senha temporária ao usuário.
        </p>

        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground mb-4">Novo usuário</p>
          <CriarUsuarioForm orgs={orgs ?? []} />
        </div>

        {users && users.length > 0 ? (
          <div className="divide-y divide-border rounded-xl border border-border">
            {(users as UserRow[]).map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-4 py-3">
                <UserCircle className="h-8 w-8 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{u.nome}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.org_nome}</p>
                </div>
                <div className="flex items-center gap-1">
                  <EditarUsuarioBtn
                    userId={u.id}
                    nome={u.nome}
                    role={u.role}
                    organizationId={u.organization_id}
                    orgs={orgs ?? []}
                  />
                  <ExcluirUsuarioBtn userId={u.id} nome={u.nome} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
        )}
      </div>
    </div>
  )
}
