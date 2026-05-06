'use client'

import { useState, useTransition } from 'react'
import { MailCheck, Loader2 } from 'lucide-react'
import { atualizarEmailEnviado } from './actions'

interface Props {
  id: string
  emailEnviado: boolean
}

export default function EmailStatusEditor({ id, emailEnviado }: Props) {
  const [checked, setChecked] = useState(emailEnviado)
  const [isPending, startTransition] = useTransition()

  function handleChange(v: boolean) {
    setChecked(v)
    startTransition(() => atualizarEmailEnviado(id, v))
  }

  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors">
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      ) : (
        <MailCheck className={`h-3.5 w-3.5 shrink-0 transition-colors ${checked ? 'text-violet-400' : 'text-muted-foreground/40'}`} />
      )}
      <input
        type="checkbox"
        checked={checked}
        onChange={e => handleChange(e.target.checked)}
        className="sr-only"
      />
      <span className={checked ? 'text-violet-400 font-medium' : ''}>
        Email {checked ? 'enviado' : 'pendente'}
      </span>
    </label>
  )
}
