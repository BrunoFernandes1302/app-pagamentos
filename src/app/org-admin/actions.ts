'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createBaseClient } from '@supabase/supabase-js'

import { requireOrgAdmin } from '@/lib/auth'
import { z } from 'zod'

const userSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').trim(),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  role: z.enum(['admin', 'member']),
})

export type OrgAdminActionState = { error?: string; success?: string } | undefined

export async function criarUsuarioOrg(
  state: OrgAdminActionState,
  formData: FormData,
): Promise<OrgAdminActionState> {
  const profile = await requireOrgAdmin()

  const parsed = userSchema.safeParse({
    nome: formData.get('nome'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }

  const adminClient = createAdminClient()

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    if (authError?.message?.includes('already registered')) return { error: 'Este email já está cadastrado.' }
    return { error: 'Erro ao criar usuário.' }
  }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: authUser.user.id,
    organization_id: profile.organization_id,
    nome: parsed.data.nome,
    role: parsed.data.role,
  })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    return { error: 'Erro ao criar perfil do usuário.' }
  }

  revalidatePath('/org-admin')
  return { success: `Usuário ${parsed.data.nome} criado com sucesso.` }
}

export async function editarUsuarioOrg(
  userId: string,
  data: {
    nome: string
    role: 'admin' | 'member'
    password?: string
  },
): Promise<{ error: string } | undefined> {
  const profile = await requireOrgAdmin()
  const adminClient = createAdminClient()

  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('organization_id, role')
    .eq('id', userId)
    .single()

  if (!targetProfile || targetProfile.organization_id !== profile.organization_id) {
    return { error: 'Usuário não encontrado nesta organização.' }
  }
  if (targetProfile.role === 'super_admin') {
    return { error: 'Não é possível editar um Super Admin.' }
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ nome: data.nome.trim(), role: data.role })
    .eq('id', userId)

  if (profileError) return { error: 'Erro ao atualizar perfil.' }

  if (data.password && data.password.length >= 8) {
    const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, {
      password: data.password,
    })
    if (pwError) return { error: 'Perfil atualizado, mas erro ao trocar senha.' }
  }

  revalidatePath('/org-admin')
}

export async function excluirUsuarioOrg(
  userId: string,
  adminPassword: string,
): Promise<{ error: string } | undefined> {
  const profile = await requireOrgAdmin()

  const adminClient = createAdminClient()

  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('organization_id, role')
    .eq('id', userId)
    .single()

  if (!targetProfile || targetProfile.organization_id !== profile.organization_id) {
    return { error: 'Usuário não encontrado nesta organização.' }
  }
  if (targetProfile.role === 'super_admin') {
    return { error: 'Não é possível excluir um Super Admin.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado.' }

  const verifyClient = createBaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error: authError } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: adminPassword,
  })
  if (authError) return { error: 'Senha incorreta.' }

  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { error: 'Erro ao excluir usuário.' }

  revalidatePath('/org-admin')
}
