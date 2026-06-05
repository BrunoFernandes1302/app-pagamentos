'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { atualizarValor } from './actions'
import type { MoedaSimples } from '@/lib/types'

function formatValor(valor: number, moeda: MoedaSimples) {
  if (moeda !== 'BRL')
    return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${moeda}`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export default function ValorEditor({ id, valor, moeda }: { id: string; valor: number; moeda: MoedaSimples }) {
  const [displayed, setDisplayed] = useState(valor)
  const [editValue, setEditValue] = useState(valor.toString())
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const parsed = parseFloat(editValue)
    if (isNaN(parsed) || parsed <= 0) return
    startTransition(async () => {
      await atualizarValor(id, parsed)
      setDisplayed(parsed)
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="number"
          step={moeda === 'BRL' ? '0.01' : '0.0001'}
          min="0"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-32 rounded border border-input bg-background px-2 py-0.5 text-sm font-bold tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
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
      onClick={() => { setEditValue(displayed.toString()); setEditing(true) }}
      className="group flex items-center gap-1 font-bold tabular-nums text-foreground hover:text-foreground/80 transition-colors"
      title="Editar valor"
    >
      <span>{formatValor(displayed, moeda)}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  )
}
