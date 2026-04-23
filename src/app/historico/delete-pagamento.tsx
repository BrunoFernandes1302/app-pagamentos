'use client'

import { useState, useTransition } from 'react'
import { Undo2, Loader2 } from 'lucide-react'
import { excluirPagamento } from './actions'

interface Props {
  id: string
  tipo: string
  comissaoPrestadorId: string | null
}

export default function DeletePagamento({ id, tipo, comissaoPrestadorId }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isComissao = tipo === 'comissao'

  function handleAction() {
    startTransition(async () => {
      await excluirPagamento(id, tipo, comissaoPrestadorId)
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-muted-foreground">
          {isComissao ? 'Reverter pagamento?' : 'Excluir?'}
        </span>
        <button
          onClick={handleAction}
          disabled={isPending}
          className="rounded px-2 py-1 text-xs font-medium text-white bg-destructive hover:bg-destructive/80 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={isComissao ? 'Reverter para comissões' : 'Reverter para resumo'}
      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
    >
      <Undo2 className="h-3.5 w-3.5" />
      Reverter
    </button>
  )
}
