'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createBaseClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from '@/lib/auth'
import { z } from 'zod'

const orgSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').trim(),
})

const userSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').trim(),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  organization_id: z.string().min(1, 'Selecione uma organização'),
  role: z.enum(['super_admin', 'admin', 'member']),
})

export type AdminActionState = { error?: string; success?: string; tempPassword?: string } | undefined

export async function criarOrganizacao(
  state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireSuperAdmin()

  const parsed = orgSchema.safeParse({ nome: formData.get('nome') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .insert({ nome: parsed.data.nome })

  if (error) return { error: 'Erro ao criar organização.' }

  revalidatePath('/admin')
  return { success: `Organização "${parsed.data.nome}" criada com sucesso.` }
}

export async function criarUsuario(
  state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireSuperAdmin()

  const parsed = userSchema.safeParse({
    nome: formData.get('nome'),
    email: formData.get('email'),
    password: formData.get('password'),
    organization_id: formData.get('organization_id'),
    role: formData.get('role'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const admin = createAdminClient()

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    if (authError?.message?.includes('already registered')) {
      return { error: 'Este email já está cadastrado.' }
    }
    return { error: 'Erro ao criar usuário.' }
  }

  const supabase = await createClient()
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authUser.user.id,
    organization_id: parsed.data.organization_id,
    nome: parsed.data.nome,
    role: parsed.data.role,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { error: 'Erro ao criar perfil do usuário.' }
  }

  revalidatePath('/admin/usuarios')
  return { success: `Usuário ${parsed.data.nome} criado com sucesso.` }
}

export async function excluirOrganizacao(
  orgId: string,
  adminPassword: string,
): Promise<{ error: string } | undefined> {
  await requireSuperAdmin()

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

  const { error } = await supabase.from('organizations').delete().eq('id', orgId)
  if (error) {
    if (error.code === '23503') return { error: 'Organização possui usuários ou dados associados.' }
    return { error: 'Erro ao excluir organização.' }
  }

  revalidatePath('/admin')
}

export async function excluirUsuario(
  userId: string,
  adminPassword: string,
): Promise<{ error: string } | undefined> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado.' }

  // Verifica senha usando client isolado (sem afetar sessão atual)
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

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: 'Erro ao excluir usuário.' }

  revalidatePath('/admin/usuarios')
}
