'use client'

import { useRef, useState, useTransition } from 'react'
import { Pencil, Check, X, Hash, QrCode, Plus, Loader2, Download, Trash2 } from 'lucide-react'
import { atualizarComprovante, atualizarComprovanteArquivo, removerComprovanteArquivo } from './actions'
import AbrirComprovanteButton from '@/components/abrir-comprovante-button'
import type { MoedaSimples } from '@/lib/types'

interface Props {
  id: string
  comprovante: string | null
  comprovanteArquivo: string | null
  comprovanteArquivoNome: string | null
  moeda: MoedaSimples
}

export default function ComprovanteEditor({
  id,
  comprovante,
  comprovanteArquivo,
  comprovanteArquivoNome,
  moeda,
}: Props) {
  const [displayed, setDisplayed] = useState<string | null>(comprovante)
  const [editValue, setEditValue] = useState(comprovante ?? '')
  const [editing, setEditing] = useState(false)
  const [hasArquivo, setHasArquivo] = useState(!!comprovanteArquivo)
  const [arquivoNome, setArquivoNome] = useState<string | null>(comprovanteArquivoNome)
  const [uploading, setUploading] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUsdt = moeda !== 'BRL'

  function handleSave() {
    startTransition(async () => {
      await atualizarComprovante(id, editValue)
      setDisplayed(editValue.trim() || null)
      setEditing(false)
    })
  }

  function handleCancel() {
    setEditValue(displayed ?? '')
    setEditing(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setErro('Apenas arquivos PDF são aceitos.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErro('O PDF deve ter no máximo 5 MB.')
      return
    }
    setErro(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('arquivo', file)
      await atualizarComprovanteArquivo(id, fd)
      setHasArquivo(true)
      setArquivoNome(file.name)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar o comprovante.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemover() {
    setRemovendo(true)
    setErro(null)
    try {
      await removerComprovanteArquivo(id)
      setHasArquivo(false)
      setArquivoNome(null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover o comprovante.')
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Campo texto: hash (USDT) ou ID/descrição (BRL) */}
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
            placeholder={isUsdt ? 'Hash da transação...' : 'ID ou descrição...'}
            className="flex-1 rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
            title="Salvar"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleCancel}
            className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
            title="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : displayed ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isUsdt ? (
            <Hash className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <QrCode className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="font-mono break-all">{displayed}</span>
          <button
            onClick={() => { setEditValue(displayed); setEditing(true) }}
            className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            title="Editar"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {isUsdt ? 'Adicionar hash' : 'Adicionar ID/descrição'}
        </button>
      )}

      {/* Arquivo PDF (apenas BRL) */}
      {!isUsdt && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasArquivo ? (
            <>
              <AbrirComprovanteButton
                historicoId={id}
                label={arquivoNome ?? 'Comprovante PDF'}
                className="inline-flex items-center gap-1 rounded border border-input px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleRemover}
                disabled={removendo}
                className="inline-flex items-center gap-1 rounded p-0.5 text-xs text-muted-foreground/60 hover:text-destructive transition-colors disabled:opacity-40"
                title="Remover comprovante"
              >
                {removendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded border border-dashed border-input px-2 py-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {uploading ? 'Enviando...' : 'Anexar comprovante (PDF)'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleFile}
              />
            </>
          )}
          {erro && <span className="text-xs text-destructive">{erro}</span>}
        </div>
      )}
    </div>
  )
}