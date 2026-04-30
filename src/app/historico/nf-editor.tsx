'use client'

import { useState, useTransition } from 'react'
import { FileCheck2, Loader2 } from 'lucide-react'
import { atualizarNotaFiscalHistorico } from './actions'

interface Props {
  id: string
  notaFiscal: boolean
}

export default function NfEditor({ id, notaFiscal }: Props) {
  const [checked, setChecked] = useState(notaFiscal)
  const [isPending, startTransition] = useTransition()

  function handleChange(v: boolean) {
    setChecked(v)
    startTransition(() => atualizarNotaFiscalHistorico(id, v))
  }

  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors">
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      ) : (
        <FileCheck2 className={`h-3.5 w-3.5 shrink-0 transition-colors ${checked ? 'text-teal-400' : 'text-muted-foreground/40'}`} />
      )}
      <input
        type="checkbox"
        checked={checked}
        onChange={e => handleChange(e.target.checked)}
        className="sr-only"
      />
      <span className={checked ? 'text-teal-400 font-medium' : ''}>
        NF {checked ? 'enviada' : 'pendente'}
      </span>
    </label>
  )
}
