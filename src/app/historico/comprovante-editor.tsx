'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Hash, QrCode, Plus, Loader2 } from 'lucide-react'
import { atualizarComprovante } from './actions'
import type { MoedaSimples } from '@/lib/types'

interface Props {
  id: string
  comprovante: string | null
  moeda: MoedaSimples
}

export default function ComprovanteEditor({ id, comprovante, moeda }: Props) {
  const [displayed, setDisplayed] = useState<string | null>(comprovante)
  const [editValue, setEditValue] = useState(comprovante ?? '')
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isUsdt = moeda === 'USDT'

  function handleSave() {
    startTransition(async () => {
      await atualizarComprovante(id, editValue)
      setDisplayed(editValue.trim() || null)
      setEditing(false)
    })
  }

  function handleCancel() {
    setEditValue(displayed ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
          placeholder={isUsdt ? 'Hash da transação...' : 'Comprovante PIX...'}
          className="flex-1 rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleSave}
          disabled={isPending || !editValue.trim()}
          className="rounded p-1 text-emerald-400 hover:bg-emerald-500/100/10 disabled:opacity-40 transition-colors"
          title="Salvar"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleCancel}
          className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
          title="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (displayed) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {isUsdt ? (
          <Hash className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <QrCode className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="font-mono break-all">{displayed}</span>
        <button
          onClick={() => { setEditValue(displayed); setEditing(true) }}
          className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="Editar"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      {isUsdt ? 'Adicionar hash' : 'Adicionar comprovante'}
    </button>
  )
}
