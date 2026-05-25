'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, XCircle, Landmark, RotateCcw, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cancelarEmprestimo, reativarEmprestimo, excluirEmprestimo } from './actions'
import EmprestimoFormDialog from './emprestimo-form-dialog'
import ParcelasDialog from './parcelas-dialog'
import type { Emprestimo, StatusEmprestimo } from '@/lib/types'

const STATUS_BADGE: Record<StatusEmprestimo, string> = {
  ativo:     'bg-emerald-500/100/15 text-emerald-400',
  quitado:   'bg-slate-500/10 text-slate-400',
  cancelado: 'bg-red-100 text-red-600',
}

const STATUS_LABEL: Record<StatusEmprestimo, string> = {
  ativo:     'Ativo',
  quitado:   'Quitado',
  cancelado: 'Cancelado',
}

function fmtValor(valor: number, moeda: string) {
  return moeda === 'BRL'
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
    : `${valor.toFixed(2)} ${moeda}`
}

interface Props {
  emprestimos: Emprestimo[]
  prestadores: { id: string; nome: string }[]
}

export default function EmprestimosList({ emprestimos, prestadores }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [parcelasEmp, setParcelasEmp] = useState<Emprestimo | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusEmprestimo>('todos')
  const [filtroPrestador, setFiltroPrestador] = useState('')

  const filtered = useMemo(() => emprestimos.filter(e => {
    const okStatus = filtroStatus === 'todos' || e.status === filtroStatus
    const okPrestador = !filtroPrestador || e.prestador_id === filtroPrestador
    return okStatus && okPrestador
  }), [emprestimos, filtroStatus, filtroPrestador])

  const emprestimosAtivos = emprestimos.filter(e => e.status === 'ativo')

  const handleCancelar = (id: string) => {
    if (!confirm('Cancelar este empréstimo? As parcelas pendentes serão mantidas no histórico.')) return
    startTransition(async () => {
      await cancelarEmprestimo(id)
      router.refresh()
    })
  }

  const handleReativar = (id: string) => {
    if (!confirm('Reativar este empréstimo?')) return
    startTransition(async () => {
      await reativarEmprestimo(id)
      router.refresh()
    })
  }

  const handleExcluir = (id: string) => {
    if (!confirm('Excluir permanentemente este empréstimo? Esta ação não pode ser desfeita.')) return
    startTransition(async () => {
      await excluirEmprestimo(id)
      router.refresh()
    })
  }

  const handleUpdate = () => {
    setParcelasEmp(null)
    router.refresh()
  }

  return (
    <>
      {/* Filtros + botão */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={filtroPrestador}
          onChange={e => setFiltroPrestador(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os prestadores</option>
          {prestadores.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>

        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="quitado">Quitados</option>
          <option value="cancelado">Cancelados</option>
        </select>

        <button
          onClick={() => setDialogOpen(true)}
          className="sm:ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo empréstimo
        </button>
      </div>

      {/* Estado vazio */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Landmark className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">Nenhum empréstimo encontrado.</p>
          {emprestimos.length === 0 && (
            <button
              onClick={() => setDialogOpen(true)}
              className="mt-3 text-sm text-blue-400 hover:underline"
            >
              Cadastrar primeiro empréstimo
            </button>
          )}
        </div>
      )}

      {/* Tabela */}
      {filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Prestador</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Empréstimo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Parcela</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Progresso</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const parcelas = emp.parcelas_emprestimo ?? []
                const pagas = parcelas.filter(p => p.status !== 'pendente').length
                const total = parcelas.length
                const pct = total > 0 ? (pagas / total) * 100 : 0
                const proxima = parcelas
                  .filter(p => p.status === 'pendente')
                  .sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia))[0]

                return (
                  <tr
                    key={emp.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {emp.prestadores?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {fmtValor(emp.valor_total, emp.moeda)}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <span>{emp.numero_parcelas}x {fmtValor(emp.valor_parcela, emp.moeda)}</span>
                      {proxima && (
                        <p className="text-xs text-muted-foreground">
                          Próx: {format(parseISO(proxima.mes_referencia), 'MMM/yy', { locale: ptBR })}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500/100 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">{pagas}/{total}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[emp.status]}`}>
                        {STATUS_LABEL[emp.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setParcelasEmp(emp)}
                          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Parcelas
                        </button>
                        {emp.status === 'ativo' && (
                          <button
                            onClick={() => handleCancelar(emp.id)}
                            disabled={isPending}
                            className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancelar
                          </button>
                        )}
                        {emp.status === 'cancelado' && (
                          <>
                            <button
                              onClick={() => handleReativar(emp.id)}
                              disabled={isPending}
                              className="flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-50 transition-colors disabled:opacity-40"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Desfazer
                            </button>
                            <button
                              onClick={() => handleExcluir(emp.id)}
                              disabled={isPending}
                              className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                          </>
                        )}
                        {emp.status === 'quitado' && (
                          <button
                            onClick={() => handleExcluir(emp.id)}
                            disabled={isPending}
                            className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
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
      )}

      {/* Dialogs */}
      {dialogOpen && (
        <EmprestimoFormDialog
          prestadores={prestadores}
          emprestimosAtivos={emprestimosAtivos}
          onClose={() => setDialogOpen(false)}
          onSuccess={() => {
            setDialogOpen(false)
            router.refresh()
          }}
        />
      )}

      {parcelasEmp && (
        <ParcelasDialog
          emprestimo={parcelasEmp}
          onClose={() => setParcelasEmp(null)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  )
}
