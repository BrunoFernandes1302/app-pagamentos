'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { Download, Loader2, X } from 'lucide-react'

const EXPORTABLE: Record<string, { module: string; label: string; usesMes?: boolean }> = {
  '/prestadores':         { module: 'prestadores',        label: 'Prestadores' },
  '/comissoes':           { module: 'comissoes',           label: 'Comissões' },
  '/emprestimos':         { module: 'emprestimos',         label: 'Empréstimos' },
  '/progressao-salarial': { module: 'progressao-salarial', label: 'Progressão Salarial' },
  '/resumo':              { module: 'resumo',              label: 'Resumo',    usesMes: true },
  '/historico':           { module: 'historico',           label: 'Histórico', usesMes: true },
}

function ExportFabInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const config = EXPORTABLE[pathname]
  if (!config) return null

  async function handleExport() {
    setLoading(true)
    setOpen(false)
    try {
      const mes = searchParams.get('mes')
      const qs = config.usesMes && mes ? `?mes=${mes}` : ''
      const res = await fetch(`/api/export/${config.module}${qs}`)
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      const match = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? `${config.module}.csv`
      a.click()
      URL.revokeObjectURL(href)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="rounded-xl border border-border bg-card shadow-xl overflow-hidden min-w-[180px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-0.5 hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <button
            onClick={handleExport}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4 text-teal-400" />
            Exportar CSV
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        title="Exportar dados"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-500 active:scale-95 transition-all disabled:opacity-70"
      >
        {loading
          ? <Loader2 className="h-5 w-5 animate-spin" />
          : <Download className="h-5 w-5" />
        }
      </button>
    </div>
  )
}

export default function ExportFab() {
  return (
    <Suspense>
      <ExportFabInner />
    </Suspense>
  )
}
