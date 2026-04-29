'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, Users } from 'lucide-react'
import type { Prestador } from '@/lib/types'
import { alternarAtivo, excluirPrestador } from './actions'
import PrestadorFormDialog from './prestador-form-dialog'

const CONTRATO_STYLE: Record<string, string> = {
  USDT: 'bg-amber-500/15 text-amber-300',
  'USDT/BRL': 'bg-blue-100 text-blue-800',
  BRL: 'bg-emerald-500/100/15 text-emerald-300',
}

function formatSalario(value: number, contrato: string) {
  if (contrato === 'USDT') {
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} USDT`
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function PrestadoresList({ prestadores }: { prestadores: Prestador[] }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrestador, setEditingPrestador] = useState<Prestador | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditingPrestador(null)
    setDialogOpen(true)
  }

  function openEdit(prestador: Prestador) {
    setEditingPrestador(prestador)
    setDialogOpen(true)
  }

  function handleToggleAtivo(prestador: Prestador) {
    setPendingToggleId(prestador.id)
    startTransition(async () => {
      try {
        await alternarAtivo(prestador.id, !prestador.ativo)
      } finally {
        setPendingToggleId(null)
      }
    })
  }

  function handleDeleteClick(id: string) {
    if (deletingId === id) {
      startTransition(async () => {
        await excluirPrestador(id)
        setDeletingId(null)
      })
    } else {
      setDeletingId(id)
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
        >
          <Plus className="h-4 w-4" />
          Adicionar Prestador
        </button>
      </div>

      {prestadores.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum prestador cadastrado.</p>
          <button
            onClick={openCreate}
            className="mt-4 text-sm font-medium text-foreground underline underline-offset-4"
          >
            Cadastrar o primeiro
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Setor / Função</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contrato</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Salário base</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Dia pag.</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {prestadores.map((p, i) => {
                  const isLast = i === prestadores.length - 1
                  const isDeleting = deletingId === p.id
                  const isToggling = pendingToggleId === p.id

                  return (
                    <tr
                      key={p.id}
                      className={`${!isLast ? 'border-b border-border' : ''} hover:bg-muted/30 transition-colors`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.nome}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{p.setor}</div>
                        <div className="text-xs text-muted-foreground">{p.funcao}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTRATO_STYLE[p.contrato]}`}
                        >
                          {p.contrato}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {formatSalario(p.salario_base, p.contrato)}
                      </td>
                      <td className="px-4 py-3 text-center text-foreground">
                        {p.dia_pagamento}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            p.ativo
                              ? 'bg-emerald-500/100/15 text-emerald-300'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            title="Editar"
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleToggleAtivo(p)}
                            title={p.ativo ? 'Desativar' : 'Ativar'}
                            disabled={isToggling}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                          >
                            {isToggling ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : p.ativo ? (
                              <ToggleRight className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>

                          {isDeleting ? (
                            <>
                              <button
                                onClick={() => handleDeleteClick(p.id)}
                                disabled={isPending}
                                className="rounded px-2 py-1 text-xs font-medium text-white bg-destructive hover:bg-destructive/80 transition-colors disabled:opacity-50"
                              >
                                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleDeleteClick(p.id)}
                              title="Excluir"
                              className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PrestadorFormDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        prestador={editingPrestador}
      />
    </>
  )
}
