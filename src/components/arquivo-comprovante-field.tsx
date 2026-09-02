'use client'

import { useRef, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { validarPdf } from '@/lib/comprovante'

interface Props {
  onArquivo: (f: File | null) => void
}

export default function ArquivoComprovanteField({ onArquivo }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(file: File | null) {
    setErro(null)
    if (!file) {
      setArquivo(null)
      onArquivo(null)
      return
    }
    const invalido = validarPdf(file)
    if (invalido) {
      setErro(invalido)
      setArquivo(null)
      onArquivo(null)
      return
    }
    setArquivo(file)
    onArquivo(file)
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={e => handleChange(e.target.files?.[0] ?? null)}
      />

      {arquivo ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
          <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="min-w-0 flex-1 truncate text-emerald-600 dark:text-emerald-400">{arquivo.name}</span>
          <button
            type="button"
            onClick={() => {
              setArquivo(null)
              onArquivo(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Remover arquivo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-input bg-transparent px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          Anexar comprovante (PDF) — opcional
        </button>
      )}

      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}