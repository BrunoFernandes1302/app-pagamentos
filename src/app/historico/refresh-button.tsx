'use client'

import { RefreshCw } from 'lucide-react'

export default function RefreshButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      title="Atualizar página"
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
    >
      <RefreshCw className="h-4 w-4" />
      Atualizar
    </button>
  )
}
