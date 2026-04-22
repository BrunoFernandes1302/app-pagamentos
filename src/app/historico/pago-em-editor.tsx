'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { atualizarPagoEm } from './actions'

function formatDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PagoEmEditor({ id, pagoEm }: { id: string; pagoEm: string }) {
  const [displayed, setDisplayed] = useState(pagoEm)
  const [editValue, setEditValue] = useState(toDatetimeLocal(pagoEm))
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const newIso = new Date(editValue).toISOString()
      await atualizarPagoEm(id, newIso)
      setDisplayed(newIso)
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="datetime-local"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
          className="rounded border border-input bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
          title="Salvar"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
          title="Cancelar"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setEditValue(toDatetimeLocal(displayed)); setEditing(true) }}
      className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Editar data de pagamento"
    >
      <span>{formatDataHora(displayed)}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  )
}
