'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, X, Copy, Check, Code2, AlertTriangle, Loader2, ChevronLeft, ExternalLink } from 'lucide-react'
import { marcarEmailsEnviados } from './actions'

type Step = 'method' | 'vba' | 'mailto'

const STORAGE_KEY = 'email_remetentes_salvos'
const MAX_SAVED = 5

function loadSavedEmails(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveEmail(email: string) {
  if (!email.trim()) return
  const current = loadSavedEmails()
  const updated = [email, ...current.filter(e => e !== email)].slice(0, MAX_SAVED)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export interface HistoricoParaEmail {
  id: string
  tipo: 'comissao' | 'salario'
  prestador_nome: string
  prestador_email: string | null
  descricao: string
  valor: number
  comprovante: string
  mes_referencia: string
}

function formatDescricao(p: HistoricoParaEmail): string {
  if (p.tipo === 'salario') {
    const [ano, mes] = p.mes_referencia.split('-').map(Number)
    return `Pagamento ${MESES[mes - 1]} de ${ano}`
  }
  // Remove o prefixo "Comissão: " que é adicionado automaticamente ao registrar
  return p.descricao.replace(/^Comiss[aã]o:\s*/i, '')
}

function esc(s: string) {
  return s.replace(/"/g, '""')
}

function toVBAString(text: string) {
  const pad = '                 '
  return text.split('\n').map(l => `"${esc(l)}"`).join(` & vbCrLf & _\n${pad}`)
}

function generateVBA(sender: string, rows: HistoricoParaEmail[]): string {
  const last = rows.length - 1
  let assignments = ''

  rows.forEach((r, i) => {
    const descricao = formatDescricao(r)
    const valorFmt = r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    const body = [
      `Olá, ${r.prestador_nome}!`,
      '',
      `Segue o comprovante referente ao pagamento abaixo:`,
      '',
      descricao,
      `Valor: ${valorFmt} USDT`,
      `HASH: ${r.comprovante}`,
      '',
      'Atenciosamente,',
    ].join('\n')

    assignments += `    arrEmail(${i}) = "${esc(r.prestador_email ?? '')}"\n`
    assignments += `    arrBody(${i})  = ${toVBAString(body)}\n`
  })

  const sentOnBehalf = sender ? `            .SentOnBehalfOfName = "${esc(sender)}"\n` : ''
  const bcc = sender ? `            .BCC = "${esc(sender)}"\n` : ''

  return `Sub EnviarComprovantes()
    Dim objOutlook  As Object
    Dim objMail     As Object
    Dim sBody       As String
    Dim sAssinatura As String
    Dim i           As Integer
    Dim tentativas  As Integer
    Dim arrEmail(${last}) As String
    Dim arrBody(${last})  As String

${assignments}
    Set objOutlook = CreateObject("Outlook.Application")
    For i = 0 To ${last}
        Set objMail = objOutlook.CreateItem(0)
        With objMail
            .To = arrEmail(i)
            .Subject = "Comprovante de Pagamento"
${sentOnBehalf}${bcc}            .Display
            ' Aguarda assinatura carregar (loop de até 10s)
            tentativas = 0
            Do While Len(.HTMLBody) < 50 And tentativas < 20
                Application.Wait Now + TimeSerial(0, 0, 0) + (500 / 86400000)
                DoEvents
                tentativas = tentativas + 1
            Loop
            sAssinatura = .HTMLBody
            sBody = "<p style='font-family:Calibri;font-size:11pt;'>" & _
                    Replace(arrBody(i), vbCrLf, "<br>") & _
                    "</p>"
            .HTMLBody = sBody & sAssinatura
            .Send
        End With
        Set objMail = Nothing
    Next i
    objOutlook.Session.SendAndReceive False
    Set objOutlook = Nothing
    MsgBox "${rows.length} email(s) enviado(s) com sucesso!", vbInformation
End Sub`
}

function generateMailtoLink(p: HistoricoParaEmail): string {
  const descricao = formatDescricao(p)
  const valorFmt = p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  const body = [
    `Olá, ${p.prestador_nome}!`,
    '',
    'Segue o comprovante referente ao pagamento abaixo:',
    '',
    descricao,
    `Valor: ${valorFmt} USDT`,
    `HASH: ${p.comprovante}`,
    '',
    'Atenciosamente,',
  ].join('\n')
  return `mailto:${encodeURIComponent(p.prestador_email ?? '')}?subject=${encodeURIComponent('Comprovante de Pagamento')}&body=${encodeURIComponent(body)}`
}

interface MailtoItem {
  id: string
  nome: string
  email: string
  link: string
}

interface Props {
  pagamentos: HistoricoParaEmail[]
}

export default function EmailVbaDialog({ pagamentos }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('method')
  const [sender, setSender] = useState('')
  const [savedEmails, setSavedEmails] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [vba, setVba] = useState('')
  const [copied, setCopied] = useState(false)
  const [mailtoGerados, setMailtoGerados] = useState<MailtoItem[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setSavedEmails(loadSavedEmails())
  }, [open])

  const semEmail = pagamentos.filter(p => !p.prestador_email)
  const elegíveis = pagamentos.filter(p => p.prestador_email)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setVba('')
    setMailtoGerados([])
  }

  function toggleAll() {
    if (selected.size === elegíveis.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(elegíveis.map(p => p.id)))
    }
    setVba('')
    setMailtoGerados([])
  }

  function handleGerar() {
    const rows = pagamentos.filter(p => selected.has(p.id))
    const ids = rows.map(p => p.id)
    saveEmail(sender)
    setSavedEmails(loadSavedEmails())
    setVba(generateVBA(sender, rows))
    startTransition(async () => {
      await marcarEmailsEnviados(ids)
      setSelected(new Set())
      router.refresh()
    })
  }

  function handleRemoveSaved(email: string) {
    const updated = savedEmails.filter(e => e !== email)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setSavedEmails(updated)
  }

  function handleCopy() {
    navigator.clipboard.writeText(vba).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleAbrirEmails() {
    const rows = pagamentos.filter(p => selected.has(p.id))
    const links: MailtoItem[] = rows.map(p => ({
      id: p.id,
      nome: p.prestador_nome,
      email: p.prestador_email ?? '',
      link: generateMailtoLink(p),
    }))
    setMailtoGerados(links)
    startTransition(async () => {
      await marcarEmailsEnviados(rows.map(p => p.id))
      setSelected(new Set())
      router.refresh()
    })
  }

  function handleClose() {
    setOpen(false)
  }

  function handleOpen() {
    setStep('method')
    setSelected(new Set())
    setVba('')
    setCopied(false)
    setMailtoGerados([])
    setOpen(true)
  }

  function handleBack() {
    setStep('method')
    setSelected(new Set())
    setVba('')
    setMailtoGerados([])
  }

  const headerTitle =
    step === 'vba' ? 'VBA Script — Outlook Clássico' :
    step === 'mailto' ? 'Mailto — Cliente de email' :
    'Enviar comprovantes por email'

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Mail className="h-4 w-4" />
        Enviar Email
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div className="flex items-center gap-2">
                {step !== 'method' && (
                  <button
                    onClick={handleBack}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <Mail className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">{headerTitle}</h2>
              </div>
              <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Step: seleção de método ── */}
            {step === 'method' && (
              <div className="px-6 py-6 space-y-5">
                <p className="text-sm text-muted-foreground">
                  Selecione como deseja enviar os comprovantes.{' '}
                  <span className="font-medium text-foreground">
                    {pagamentos.length} pagamento{pagamentos.length !== 1 ? 's' : ''} disponível{pagamentos.length !== 1 ? 'is' : ''} para envio.
                  </span>
                </p>

                {pagamentos.length === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum pagamento USDT com hash cadastrado neste mês.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setStep('vba')}
                      className="flex flex-col items-center text-center gap-3 rounded-xl border border-border bg-card p-6 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                    >
                      <div className="rounded-lg bg-muted p-3 group-hover:bg-primary/10 transition-colors">
                        <Code2 className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">VBA Script</p>
                        <p className="text-xs text-muted-foreground mt-1">Windows · Excel · Outlook Clássico</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setStep('mailto')}
                      className="flex flex-col items-center text-center gap-3 rounded-xl border border-border bg-card p-6 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                    >
                      <div className="rounded-lg bg-muted p-3 group-hover:bg-primary/10 transition-colors">
                        <ExternalLink className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Mailto</p>
                        <p className="text-xs text-muted-foreground mt-1">Mac · Outlook Moderno · Apple Mail</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Step: VBA (fluxo original, sem alterações) ── */}
            {step === 'vba' && (
              <div className="px-6 py-5 space-y-5">

                {/* Remetente */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Email do remetente
                  </label>
                  <input
                    type="email"
                    value={sender}
                    onChange={e => { setSender(e.target.value); setVba('') }}
                    placeholder="financeiro@suaempresa.com.br"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Usado como remetente e BCC. Sua assinatura do Outlook é incluída automaticamente.</p>

                  {savedEmails.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {savedEmails.map(email => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          <button
                            type="button"
                            onClick={() => { setSender(email); setVba('') }}
                            className="hover:text-foreground transition-colors"
                          >
                            {email}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSaved(email)}
                            className="ml-0.5 rounded-full hover:text-foreground transition-colors"
                            aria-label="Remover"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Estado vazio */}
                {pagamentos.length === 0 && (
                  <div className="rounded-lg border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum pagamento USDT com hash cadastrado neste mês.
                  </div>
                )}

                {/* Aviso sem email */}
                {semEmail.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      {semEmail.map(p => p.prestador_nome).join(', ')} não {semEmail.length === 1 ? 'possui' : 'possuem'} email cadastrado e {semEmail.length === 1 ? 'não pode' : 'não podem'} ser selecionado{semEmail.length === 1 ? '' : 's'}.
                    </span>
                  </div>
                )}

                {/* Lista de pagamentos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">
                      Selecionar pagamentos ({selected.size} selecionado{selected.size !== 1 ? 's' : ''})
                    </label>
                    {elegíveis.length > 0 && (
                      <button
                        onClick={toggleAll}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {selected.size === elegíveis.length ? 'Desmarcar todos' : 'Selecionar todos'}
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border border-border p-1">
                    {pagamentos.map(p => {
                      const temEmail = !!p.prestador_email
                      const isChecked = selected.has(p.id)
                      const descricao = formatDescricao(p)
                      const valorFmt = p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

                      return (
                        <label
                          key={p.id}
                          className={`flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                            temEmail
                              ? isChecked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'
                              : 'opacity-40 cursor-not-allowed border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!temEmail}
                            onChange={() => toggle(p.id)}
                            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{p.prestador_nome}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                p.tipo === 'comissao' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-blue-500/15 text-blue-500'
                              }`}>
                                {p.tipo === 'comissao' ? 'Comissão' : 'Salário'}
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-foreground">{valorFmt} USDT</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{descricao}</p>
                            {temEmail && (
                              <p className="text-xs text-muted-foreground/60 mt-0.5">{p.prestador_email}</p>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Botão gerar */}
                <button
                  onClick={handleGerar}
                  disabled={selected.size === 0 || isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
                  {isPending ? 'Registrando...' : `Gerar Script VBA (${selected.size} email${selected.size !== 1 ? 's' : ''})`}
                </button>

                {/* Output VBA */}
                {vba && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">Script VBA gerado</label>
                      <button
                        onClick={handleCopy}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          copied
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="rounded-lg bg-[#1a202c] text-[#68d391] font-mono text-xs p-4 overflow-x-auto max-h-56 overflow-y-auto leading-relaxed whitespace-pre">
                      {vba}
                    </pre>
                    <div className="mt-3 rounded-lg border-l-4 border-blue-400 bg-blue-500/10 px-4 py-3 text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                      <p className="font-semibold mb-1">Como usar:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Excel → <strong>Alt + F11</strong></li>
                        <li><strong>Inserir → Módulo</strong></li>
                        <li>Apague o código antigo e cole o novo</li>
                        <li><strong>F5</strong> para executar</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step: Mailto ── */}
            {step === 'mailto' && (
              <div className="px-6 py-5 space-y-5">

                {/* Estado vazio */}
                {pagamentos.length === 0 && (
                  <div className="rounded-lg border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum pagamento USDT com hash cadastrado neste mês.
                  </div>
                )}

                {/* Aviso sem email */}
                {semEmail.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      {semEmail.map(p => p.prestador_nome).join(', ')} não {semEmail.length === 1 ? 'possui' : 'possuem'} email cadastrado e {semEmail.length === 1 ? 'não pode' : 'não podem'} ser selecionado{semEmail.length === 1 ? '' : 's'}.
                    </span>
                  </div>
                )}

                {/* Lista de pagamentos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">
                      Selecionar pagamentos ({selected.size} selecionado{selected.size !== 1 ? 's' : ''})
                    </label>
                    {elegíveis.length > 0 && (
                      <button
                        onClick={toggleAll}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {selected.size === elegíveis.length ? 'Desmarcar todos' : 'Selecionar todos'}
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border border-border p-1">
                    {pagamentos.map(p => {
                      const temEmail = !!p.prestador_email
                      const isChecked = selected.has(p.id)
                      const descricao = formatDescricao(p)
                      const valorFmt = p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

                      return (
                        <label
                          key={p.id}
                          className={`flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                            temEmail
                              ? isChecked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'
                              : 'opacity-40 cursor-not-allowed border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!temEmail}
                            onChange={() => toggle(p.id)}
                            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{p.prestador_nome}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                p.tipo === 'comissao' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-blue-500/15 text-blue-500'
                              }`}>
                                {p.tipo === 'comissao' ? 'Comissão' : 'Salário'}
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-foreground">{valorFmt} USDT</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{descricao}</p>
                            {temEmail && (
                              <p className="text-xs text-muted-foreground/60 mt-0.5">{p.prestador_email}</p>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Botão gerar links */}
                <button
                  onClick={handleAbrirEmails}
                  disabled={selected.size === 0 || isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  {isPending ? 'Registrando...' : `Gerar links de email (${selected.size} email${selected.size !== 1 ? 's' : ''})`}
                </button>

                {/* Links gerados */}
                {mailtoGerados.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Clique para abrir cada email no Outlook:
                    </label>
                    <div className="space-y-2">
                      {mailtoGerados.map(item => (
                        <a
                          key={item.id}
                          href={item.link}
                          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{item.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.email}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 shrink-0 ml-3 text-muted-foreground group-hover:text-primary transition-colors" />
                        </a>
                      ))}
                    </div>
                    <div className="mt-3 rounded-lg border-l-4 border-blue-400 bg-blue-500/10 px-4 py-3 text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                      <p className="font-semibold mb-1">Lembre-se:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Clique em cada nome acima para abrir no Outlook</li>
                        <li>Troque a caixa de envio para a conta correta</li>
                        <li>Confirme e envie</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
