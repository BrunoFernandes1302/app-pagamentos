'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, XCircle, CalendarDays, TrendingUp } from 'lucide-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, differenceInMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ProgressaoSalarial, TipoContrato, CriptoMoeda } from '@/lib/types'
import { CONTRATO_LABEL } from '@/lib/types'
import { cancelarProgressao } from './actions'
import ProgressaoFormDialog, { type PrestadorSimples } from './progressao-form-dialog'
import CronogramaDialog from './cronograma-dialog'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type ProgressaoComPrestador = ProgressaoSalarial & {
  prestadores: { nome: string; contrato: TipoContrato; cripto_moeda: CriptoMoeda } | null
}

type ProgressaoAtiva = ProgressaoSalarial & {
  prestadores: { nome: string; contrato: TipoContrato; cripto_moeda: CriptoMoeda }
}

function getMesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getSalarioMes(p: ProgressaoSalarial, mes: string): number {
  const mesInicio = parseISO(p.mes_inicio)
  const mesSel = parseISO(mes + '-01')
  if (mesSel < mesInicio) return p.salario_inicial
  const n = differenceInMonths(mesSel, mesInicio)
  return Math.min(p.salario_inicial + p.incremento * (n + 1), p.salario_alvo)
}

function getTotalMeses(p: ProgressaoSalarial): number {
  return Math.ceil((p.salario_alvo - p.salario_inicial) / p.incremento)
}

function getMesesDecorridos(p: ProgressaoSalarial, mes: string): number {
  const mesInicio = parseISO(p.mes_inicio)
  const mesSel = parseISO(mes + '-01')
  if (mesSel < mesInicio) return 0
  return Math.min(differenceInMonths(mesSel, mesInicio) + 1, getTotalMeses(p))
}

function formatValor(valor: number, contrato: TipoContrato, cripto_moeda: CriptoMoeda): string {
  if (contrato === 'USDT') {
    return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${cripto_moeda}`
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

interface Props {
  progressoes: ProgressaoComPrestador[]
  prestadores: PrestadorSimples[]
}

export default function ProgressaoList({ progressoes, prestadores }: Props) {
  const router = useRouter()
  const [mes, setMes] = useState(getMesAtual())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProgressao, setEditingProgressao] = useState<ProgressaoComPrestador | null>(null)
  const [defaultPrestadorId, setDefaultPrestadorId] = useState<string | null>(null)
  const [cronogramaProgressao, setCronogramaProgressao] = useState<ProgressaoComPrestador | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [ano, mesNum] = mes.split('-').map(Number)

  function navegarMes(delta: number) {
    let novoMes = mesNum + delta
    let novoAno = ano
    if (novoMes > 12) { novoMes = 1; novoAno++ }
    if (novoMes < 1) { novoMes = 12; novoAno-- }
    setMes(`${novoAno}-${String(novoMes).padStart(2, '0')}`)
  }

  const progressoesAtivas = progressoes.filter(
    (p): p is ProgressaoAtiva => p.status === 'ativo' && p.prestadores !== null
  )
  const prestadoresComProgressao = new Set(progressoesAtivas.map((p) => p.prestador_id))
  const prestadoresSem = prestadores.filter((p) => !prestadoresComProgressao.has(p.id))

  function abrirNova(prestadorId?: string) {
    setEditingProgressao(null)
    setDefaultPrestadorId(prestadorId ?? null)
    setDialogOpen(true)
  }

  const mesAtualStr = getMesAtual()

  function progressaoIniciada(p: ProgressaoComPrestador) {
    return p.mes_inicio.substring(0, 7) <= mesAtualStr
  }

  function handleCancelar(id: string) {
    if (cancelingId !== id) {
      setCancelingId(id)
      return
    }
    startTransition(async () => {
      try {
        await cancelarProgressao(id)
        setCancelingId(null)
        router.refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Erro ao cancelar')
        setCancelingId(null)
      }
    })
  }

  const isMesAtual = mes === mesAtualStr

  return (
    <>
      {/* Seletor de mês + botão nova */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <button
          onClick={() => navegarMes(-1)}
          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="min-w-[160px] text-center">
          <p className="font-semibold text-foreground">{MESES[mesNum - 1]} {ano}</p>
          {isMesAtual && <p className="text-xs text-muted-foreground">mês atual</p>}
        </div>

        <button
          onClick={() => navegarMes(1)}
          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => abrirNova()}
          className="ml-auto flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova progressão
        </button>
      </div>

      {/* Progressões ativas */}
      {progressoesAtivas.length > 0 && (
        <div className="space-y-4 mb-8">
          {progressoesAtivas.map((p) => {
            const contrato = p.prestadores.contrato
            const cripto_moeda = p.prestadores.cripto_moeda
            const salarioAtual = getSalarioMes(p, mes)
            const totalMeses = getTotalMeses(p)
            const mesesDecorridos = getMesesDecorridos(p, mes)
            const pct = Math.min((mesesDecorridos / totalMeses) * 100, 100)
            const isConcluido = salarioAtual >= p.salario_alvo
            const mesConclusao = addMonths(parseISO(p.mes_inicio), totalMeses - 1)
            const isCanceling = cancelingId === p.id
            const progressaoNaoIniciada = parseISO(p.mes_inicio) > parseISO(mes + '-01')

            return (
              <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Cabeçalho do card */}
                <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4 border-b border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-fit rounded-lg p-2 bg-violet-500/10 shrink-0">
                      <TrendingUp className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{p.prestadores.nome}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            isConcluido && !progressaoNaoIniciada
                              ? 'bg-emerald-500/100/15 text-emerald-300'
                              : progressaoNaoIniciada
                              ? 'bg-slate-500/10 text-slate-400'
                              : 'bg-violet-100 text-violet-800'
                          }`}
                        >
                          {progressaoNaoIniciada
                            ? 'Não iniciado'
                            : isConcluido
                            ? 'Meta atingida'
                            : 'Em progressão'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatValor(p.salario_inicial, contrato, cripto_moeda)}
                        {' → '}
                        {formatValor(p.salario_alvo, contrato, cripto_moeda)}
                        {' · +'}
                        {formatValor(p.incremento, contrato, cripto_moeda)}
                        /mês
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingProgressao(p); setDialogOpen(true) }}
                      title="Editar"
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    {!progressaoIniciada(p) && (
                      isCanceling ? (
                        <>
                          <button
                            onClick={() => handleCancelar(p.id)}
                            disabled={isPending}
                            className="rounded px-2 py-1 text-xs font-medium text-white bg-destructive hover:bg-destructive/80 transition-colors disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setCancelingId(null)}
                            className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleCancelar(p.id)}
                          title="Cancelar progressão"
                          className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-destructive transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Corpo do card */}
                <div className="px-5 py-4">
                  {progressaoNaoIniciada ? (
                    <p className="text-sm text-muted-foreground">
                      Progressão inicia em{' '}
                      <span className="font-medium text-foreground capitalize">
                        {format(parseISO(p.mes_inicio), "MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </p>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-2xl font-bold tabular-nums text-foreground">
                          {formatValor(salarioAtual, contrato, cripto_moeda)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          em {MESES[mesNum - 1].toLowerCase()}
                        </span>
                      </div>

                      {/* Barra de progresso */}
                      <div className="mb-2">
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isConcluido ? 'bg-emerald-500/100' : 'bg-violet-500/100'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                          <span>{mesesDecorridos} de {totalMeses} meses</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                      </div>

                      {!isConcluido && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Meta prevista para{' '}
                          <span className="capitalize">
                            {format(mesConclusao, "MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </p>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => setCronogramaProgressao(p)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Ver cronograma completo
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Prestadores sem progressão */}
      {prestadoresSem.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Sem progressão ativa ({prestadoresSem.length})
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {prestadoresSem.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Salário atual: {formatValor(p.salario_base, p.contrato, p.cripto_moeda)}
                  </p>
                </div>
                <button
                  onClick={() => abrirNova(p.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-500/100/20 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Iniciar progressão
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado vazio total */}
      {progressoesAtivas.length === 0 && prestadoresSem.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum prestador ativo cadastrado.</p>
        </div>
      )}

      <ProgressaoFormDialog
        isOpen={dialogOpen}
        onClose={() => { setDialogOpen(false); router.refresh() }}
        progressao={editingProgressao}
        prestadores={prestadores}
        prestadoresComProgressao={prestadoresComProgressao}
        defaultPrestadorId={defaultPrestadorId}
      />

      {cronogramaProgressao && (
        <CronogramaDialog
          progressao={cronogramaProgressao}
          onClose={() => setCronogramaProgressao(null)}
        />
      )}
    </>
  )
}
