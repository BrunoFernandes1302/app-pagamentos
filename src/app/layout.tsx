import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'
import CotacaoWidget from '@/app/comissoes/cotacao-widget'
import Link from 'next/link'
import { Settings } from 'lucide-react'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'StableLedger',
  description: 'Gerenciamento de pagamentos e prestadores de serviço',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: { nome: string; role: string; orgNome: string } | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('nome, role, organizations(nome)')
      .eq('id', user.id)
      .single()
    if (data) {
      profile = {
        nome: data.nome as string,
        role: data.role as string,
        orgNome: (data.organizations as { nome: string } | null)?.nome ?? '',
      }
    }
  }

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user && profile && (
          <div className="sticky top-0 z-30 border-b border-border bg-card px-4 py-1.5 flex items-center justify-between gap-4">
            <CotacaoWidget />
            <div className="flex items-center gap-3">
              {profile.role === 'super_admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
              <span className="text-xs text-muted-foreground hidden sm:block">
                {profile.orgNome && <span className="mr-1 opacity-60">{profile.orgNome} ·</span>}
                {profile.nome}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Sair
                </button>
              </form>
            </div>
          </div>
        )}
        {children}
      </body>
    </html>
  )
}
