'use client'

import { useState } from 'react'
import { FileText, Loader2, Download } from 'lucide-react'

interface Props {
  historicoId: string
  label?: string
  className?: string
  downloadClassName?: string
}

export default function AbrirComprovanteButton({
  historicoId,
  label = 'PDF',
  className,
  downloadClassName,
}: Props) {
  const [carregando, setCarregando] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function buscarUrl(baixar: boolean): Promise<string> {
    const qs = baixar ? '?json=1&download=1' : '?json=1'
    const res = await fetch(`/api/comprovantes/${historicoId}${qs}`)
    if (!res.ok) throw new Error()
    const { url } = await res.json()
    return url
  }

  async function abrir() {
    setCarregando(true)
    setErro(null)
    // Abre a aba antes do await para não ser bloqueada como popup.
    // Sem 'noopener' aqui: com ele o browser retorna null e perdemos a referência.
    const aba = window.open('', '_blank')
    if (!aba) {
      setCarregando(false)
      setErro('Permita pop-ups para abrir o comprovante.')
      return
    }
    try {
      const url = await buscarUrl(false)
      aba.opener = null
      aba.location.replace(url)
    } catch {
      aba.close()
      setErro('Não foi possível abrir o comprovante.')
    } finally {
      setCarregando(false)
    }
  }

  async function baixar() {
    setBaixando(true)
    setErro(null)
    try {
      const url = await buscarUrl(true)
      const a = document.createElement('a')
      a.href = url
      a.download = ''
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      setErro('Não foi possível baixar o comprovante.')
    } finally {
      setBaixando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={carregando}
        title="Abrir comprovante PDF em nova aba"
        className={className}
      >
        {carregando ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
        {label}
      </button>
      <button
        type="button"
        onClick={baixar}
        disabled={baixando}
        title="Baixar comprovante PDF"
        className={downloadClassName ?? className}
      >
        {baixando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      </button>
      {erro && <span className="text-xs text-destructive">{erro}</span>}
    </>
  )
}