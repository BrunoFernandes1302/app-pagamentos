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
} from "lucide-react";

const modules = [
  {
    href: "/comissoes",
    icon: Percent,
    title: "Comissões",
    description: "Gerencie e calcule comissões dos prestadores de serviço.",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
  {
    href: "/emprestimos",
    icon: Landmark,
    title: "Empréstimos",
    description: "Controle de empréstimos concedidos aos prestadores.",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    href: "/progressao-salarial",
    icon: TrendingUp,
    title: "Progressão Salarial",
    description: "Acompanhe o aumento progressivo de salário dos prestadores.",
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50",
  },
  {
    href: "/prestadores",
    icon: Users,
    title: "Prestadores",
    description: "Cadastre, edite e remova prestadores de serviço.",
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50",
  },
  {
    href: "/resumo",
    icon: Receipt,
    title: "Resumo de Pagamentos",
    description: "Visualize o pagamento antes e após todas as atribuições.",
    iconColor: "text-teal-600",
    iconBg: "bg-teal-50",
  },
  {
    href: "/historico",
    icon: CalendarDays,
    title: "Histórico de Pagamentos",
    description: "Consulte o histórico de folha e comissões por período.",
    iconColor: "text-slate-600",
    iconBg: "bg-slate-100",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let orgNome = '';
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('organizations(nome)')
      .eq('id', user.id)
      .single();
    orgNome = (data?.organizations as unknown as { nome: string } | null)?.nome ?? '';
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
      </main>
    </div>
  );
}
