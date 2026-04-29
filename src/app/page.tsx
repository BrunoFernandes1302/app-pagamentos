import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Percent,
  Landmark,
  TrendingUp,
  Users,
  Receipt,
  CalendarDays,
  ChevronRight,
  Settings,
} from "lucide-react";

const modules = [
  {
    href: "/comissoes",
    icon: Percent,
    title: "Comissões",
    description: "Gerencie e calcule comissões dos prestadores de serviço.",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
  },
  {
    href: "/emprestimos",
    icon: Landmark,
    title: "Empréstimos",
    description: "Controle de empréstimos concedidos aos prestadores.",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  {
    href: "/progressao-salarial",
    icon: TrendingUp,
    title: "Progressão Salarial",
    description: "Acompanhe o aumento progressivo de salário dos prestadores.",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/10",
  },
  {
    href: "/prestadores",
    icon: Users,
    title: "Prestadores",
    description: "Cadastre, edite e remova prestadores de serviço.",
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/10",
  },
  {
    href: "/resumo",
    icon: Receipt,
    title: "Resumo de Pagamentos",
    description: "Visualize o pagamento antes e após todas as atribuições.",
    iconColor: "text-teal-400",
    iconBg: "bg-teal-500/10",
  },
  {
    href: "/historico",
    icon: CalendarDays,
    title: "Histórico de Pagamentos",
    description: "Consulte o histórico de folha e comissões por período.",
    iconColor: "text-slate-400",
    iconBg: "bg-slate-500/10",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let orgNome = '';
  let userRole = '';
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, organizations(nome)')
      .eq('id', user.id)
      .single();
    orgNome = (data?.organizations as unknown as { nome: string } | null)?.nome ?? '';
    userRole = data?.role ?? '';
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-5">
        <div className="mx-auto max-w-5xl">
          {orgNome && (
            <p className="text-sm font-medium text-muted-foreground">
              {orgNome}
            </p>
          )}
          <h1 className="text-2xl font-bold text-foreground">
            StableLedger
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="mb-8 text-sm text-muted-foreground">
          Selecione um módulo para continuar.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ href, icon: Icon, title, description, iconColor, iconBg }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className={`w-fit rounded-lg p-3 ${iconBg}`}>
                <Icon className={`h-6 w-6 ${iconColor}`} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                Acessar
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>

        {(userRole === 'admin' || userRole === 'super_admin') && (
          <div className="mt-8 pt-8 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Administração
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/org-admin"
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 transition-shadow hover:shadow-md"
              >
                <div className="w-fit rounded-lg p-2 bg-slate-500/10">
                  <Settings className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Gerenciar Organização</p>
                  <p className="text-xs text-muted-foreground">Usuários e acessos</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-2 group-hover:text-foreground transition-colors" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
