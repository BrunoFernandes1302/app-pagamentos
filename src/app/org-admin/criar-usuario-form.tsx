'use client'

import { useActionState, useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { criarUsuarioOrg, type OrgAdminActionState } from './actions'

export function CriarUsuarioOrgForm() {
  const [state, action, pending] = useActionState<OrgAdminActionState, FormData>(
    criarUsuarioOrg,
    undefined,
  )

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('member')

  useEffect(() => {
    if (state?.success) {
      setNome('')
      setEmail('')
      setPassword('')
      setRole('member')
    }
  }, [state])

  const inputClass =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Nome</label>
          <input
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Nome completo"
            disabled={pending}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Email</label>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="email@empresa.com"
            disabled={pending}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Senha temporária</label>
          <input
            name="password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            disabled={pending}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Perfil</label>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            disabled={pending}
            className={inputClass}
          >
            <option value="member">Membro</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Criar usuário
      </button>
    </form>
  )
}
