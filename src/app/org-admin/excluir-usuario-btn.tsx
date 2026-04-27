'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2, X } from 'lucide-react'
import { excluirUsuarioOrg } from './actions'

export function ExcluirUsuarioOrgBtn({ userId, nome }: { userId: string; nome: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  function handleOpen() {
    setPassword('')
    setError(undefined)
    setOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    startTransition(async () => {
      const result = await excluirUsuarioOrg(userId, password)
      if (result?.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  const inputClass =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title={`Excluir ${nome}`}
        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 mx-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Excluir usuário</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Esta ação é irreversível. Digite sua senha para confirmar a exclusão de{' '}
                  <span className="font-medium text-foreground">{nome}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">Sua senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isPending}
                  autoFocus
                  className={inputClass}
                />
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !password}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Excluir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
