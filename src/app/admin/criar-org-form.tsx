'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { criarOrganizacao, type AdminActionState } from './actions'

export function CriarOrgForm() {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    criarOrganizacao,
    undefined,
  )

  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2">
        <input
          name="nome"
          required
          placeholder="Nome da organização"
          disabled={pending}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Criar
        </button>
      </div>
      {state?.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-emerald-400">{state.success}</p>
      )}
    </form>
  )
}
