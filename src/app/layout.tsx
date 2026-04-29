import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'
import CotacaoWidget from '@/app/comissoes/cotacao-widget'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import ThemeToggle from '@/components/theme-toggle'

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
        orgNome: (data.organizations as unknown as { nome: string } | null)?.nome ?? '',
      }
    }
  }

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('theme')==='light'){var e=document.documentElement;var v={'--background':'oklch(1 0 0)','--foreground':'oklch(0.145 0 0)','--card':'oklch(1 0 0)','--card-foreground':'oklch(0.145 0 0)','--popover':'oklch(1 0 0)','--popover-foreground':'oklch(0.145 0 0)','--primary':'oklch(0.205 0 0)','--primary-foreground':'oklch(0.985 0 0)','--secondary':'oklch(0.97 0 0)','--secondary-foreground':'oklch(0.205 0 0)','--muted':'oklch(0.97 0 0)','--muted-foreground':'oklch(0.556 0 0)','--accent':'oklch(0.97 0 0)','--accent-foreground':'oklch(0.205 0 0)','--destructive':'oklch(0.577 0.245 27.325)','--border':'oklch(0.922 0 0)','--input':'oklch(0.922 0 0)','--ring':'oklch(0.708 0 0)'};Object.keys(v).forEach(function(k){e.style.setProperty(k,v[k])})}}catch(e){}})()` }} />
      </head>
      <body className="min-h-full flex flex-col">
        {user && profile && (
          <div className="sticky top-0 z-30 border-b border-border bg-card px-4 py-1.5 flex items-center justify-between gap-4">
            <CotacaoWidget />
            <div className="flex items-center gap-3">
              <ThemeToggle />
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
