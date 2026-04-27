'use client'

import { useState, useTransition } from 'react'
import { Pencil, Loader2, X } from 'lucide-react'
import { editarUsuario } from '../actions'

type Org = { id: string; nome: string }

interface Props {
  userId: string
  nome: string
  role: string
  organizationId: string
  orgs: Org[]
}

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

export function EditarUsuarioBtn({ userId, nome, role, organizationId, orgs }: Props) {
  const [open, setOpen] = useState(false)
  const [nomeVal, setNomeVal] = useState(nome)
  const [roleVal, setRoleVal] = useState(role)
  const [orgVal, setOrgVal] = useState(organizationId)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleOpen() {
    setNomeVal(nome)
    setRoleVal(role)
    setOrgVal(organizationId)
    setPassword('')
    setError(undefined)
    setSuccess(false)
    setOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nomeVal.trim()) return
    setError(undefined)
    setSuccess(false)
    startTransition(async () => {
      const result = await editarUsuario(userId, {
        nome: nomeVal,
        role: roleVal as 'super_admin' | 'admin' | 'member',
        organization_id: orgVal,
        password: password || undefined,
      })
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setOpen(false), 800)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title={`Editar ${nome}`}
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 mx-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-semibold text-foreground">Editar usuário</p>
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
                <label className="block text-sm font-medium text-foreground">Nome</label>
                <input
                  type="text"
                  value={nomeVal}
                  onChange={(e) => setNomeVal(e.target.value)}
                  required
                  disabled={isPending}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">Organização</label>
                <select
                  value={orgVal}
                  onChange={(e) => setOrgVal(e.target.value)}
                  disabled={isPending}
                  className={inputClass}
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">Perfil</label>
                <select
                  value={roleVal}
                  onChange={(e) => setRoleVal(e.target.value)}
                  disabled={isPending}
                  className={inputClass}
                >
                  <option value="member">Membro</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Nova senha <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Deixe em branco para não alterar"
                  disabled={isPending}
                  className={inputClass}
                />
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              {success && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Usuário atualizado.
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
                  disabled={isPending || !nomeVal.trim()}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
