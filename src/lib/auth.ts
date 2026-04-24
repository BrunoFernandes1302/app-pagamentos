import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getOrganizationId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/auth/login')
  return profile.organization_id
}

export async function getUserProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, nome, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')
  return { ...profile, email: user.email! }
}

export async function requireSuperAdmin() {
  const profile = await getUserProfile()
  if (profile.role !== 'super_admin') redirect('/')
  return profile
}
