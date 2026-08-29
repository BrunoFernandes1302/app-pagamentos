'use client'

import { useState } from 'react'
import { FileArchive, X, Loader2, Download, AlertTriangle } from 'lucide-react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatMes(yyyyMm: string) {
  const [ano, mes] = yyyyMm.split('-').map(Number)
  return `${MESES[mes - 1]} ${ano}`
}

interface Props {
  mesAtual: string
  prestadores: { id: string; nome: string }[]
  meses: string[]
}

export default function BaixarPdfsDialog({ mesAtual, prestadores, meses }: Props) {
  const [open, setOpen] = useState(false)
  const [mes, setMes] = useState<string>(mesAtual)
  const [prestador, setPrestador] = useState<string>('')
  const [baixando, setBaixando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function handleOpen() {
    setMes(mesAtual)
    setPrestador('')
    setErro(null)
    setOpen(true)
  }

  async function handleBaixar() {
    setBaixando(true)
    setErro(null)
    try {
      const qs = new URLSearchParams()
      if (mes) qs.set('mes', mes)
      if (prestador) qs.set('prestador', prestador)

      const res = await fetch(`/api/comprovantes/zip?${qs.toString()}`)
      if (!res.ok) {
        const msg = await res.json().catch(() => null)
        throw new Error(msg?.error ?? 'Não foi possível gerar o arquivo.')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const match = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? 'comprovantes.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setOpen(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o arquivo.')
    } finally {
      setBaixando(false)
    }
  }

  const selectClass =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  const resumo = [
    prestador ? prestadores.find(p => p.id === prestador)?.nome : 'Todos os prestadores',
    mes ? formatMes(mes) : 'Todos os meses',
  ].join(' · ')

  return (
    <>
      <button
        onClick={handleOpen}
        title="Baixar comprovantes em PDF"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <FileArchive className="h-4 w-4" />
        Baixar PDF&apos;s
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !baixando && setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">

            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Baixar comprovantes</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={baixando}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Os comprovantes em PDF serão baixados em uma pasta compactada (.zip).
                Combine os filtros para restringir o resultado.
              </p>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Mês</label>
                <select value={mes} onChange={e => setMes(e.target.value)} className={selectClass}>
                  <option value="">Todos os meses</option>
                  {meses.map(m => (
                    <option key={m} value={m}>{formatMes(m)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Prestador</label>
                <select
                  value={prestador}
                  onChange={e => setPrestador(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Todos os prestadores</option>
                  {prestadores.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Baixando: <span className="font-medium text-foreground">{resumo}</span>
                </p>
              </div>

              {erro && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                onClick={() => setOpen(false)}
                disabled={baixando}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleBaixar}
                disabled={baixando}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {baixando ? 'Gerando .zip...' : 'Baixar .zip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}