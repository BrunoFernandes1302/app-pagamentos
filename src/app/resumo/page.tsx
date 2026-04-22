import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";

export default function ResumoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-5">
        <div className="mx-auto max-w-5xl flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Início
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">Resumo de Pagamentos</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-fit rounded-lg p-3 bg-teal-50">
            <Receipt className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Resumo de Pagamentos</h1>
            <p className="text-sm text-muted-foreground">
              Pagamento antes e após todas as atribuições
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Em desenvolvimento.</p>
        </div>
      </main>
    </div>
  );
}
