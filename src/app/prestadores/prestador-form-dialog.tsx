'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import { criarPrestador, atualizarPrestador } from './actions'
import type { Prestador, PrestadorInput, TipoChavePix } from '@/lib/types'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  setor: z.string().min(1, 'Setor obrigatório'),
  funcao: z.string().min(1, 'Função obrigatória'),
  data_inicio: z.string().min(1, 'Data de início obrigatória'),
  contrato: z.enum(['USDT', 'USDT/BRL', 'BRL']),
  cripto_moeda: z.enum(['USDT', 'USDC']).default('USDT'),
  salario_base: z.coerce.number().positive('Deve ser maior que zero'),
  dia_pagamento: z.coerce.number().int().min(1, 'Mínimo 1').max(31, 'Máximo 31'),
  carteira_cripto: z.string().optional(),
  rede_cripto: z.string().optional(),
  chave_pix: z.string().optional(),
  tipo_chave_pix: z.string().optional(),
  ativo: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.contrato !== 'BRL') {
    if (!data.carteira_cripto?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['carteira_cripto'], message: 'Carteira obrigatória' })
    }
    if (!data.rede_cripto?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['rede_cripto'], message: 'Rede obrigatória' })
    }
  } else {
    if (!data.tipo_chave_pix) {
      ctx.addIssue({ code: 'custom', path: ['tipo_chave_pix'], message: 'Tipo obrigatório' })
    }
    if (!data.chave_pix?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['chave_pix'], message: 'Chave PIX obrigatória' })
    } else {
      const tipo = data.tipo_chave_pix
      const chave = data.chave_pix
      if (tipo === 'cpf' && chave.replace(/\D/g, '').length !== 11) {
        ctx.addIssue({ code: 'custom', path: ['chave_pix'], message: 'CPF incompleto (11 dígitos)' })
      } else if (tipo === 'cnpj' && chave.replace(/\D/g, '').length !== 14) {
        ctx.addIssue({ code: 'custom', path: ['chave_pix'], message: 'CNPJ incompleto (14 dígitos)' })
      } else if (tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave)) {
        ctx.addIssue({ code: 'custom', path: ['chave_pix'], message: 'E-mail inválido' })
      } else if (tipo === 'telefone' && !/^\(\d{2}\) \d{4,5}-\d{4}$/.test(chave)) {
        ctx.addIssue({ code: 'custom', path: ['chave_pix'], message: 'Telefone incompleto' })
      } else if (tipo === 'aleatoria' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(chave)) {
        ctx.addIssue({ code: 'custom', path: ['chave_pix'], message: 'Chave deve ser um UUID válido' })
      }
    }
  }
})

type FormData = z.infer<typeof schema>

// ─── Máscaras PIX ─────────────────────────────────────────────────────────────

function mascaraCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function mascaraCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function mascaraAleatoria(v: string): string {
  const d = v.toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 32)
  if (d.length <= 8) return d
  if (d.length <= 12) return `${d.slice(0, 8)}-${d.slice(8)}`
  if (d.length <= 16) return `${d.slice(0, 8)}-${d.slice(8, 12)}-${d.slice(12)}`
  if (d.length <= 20) return `${d.slice(0, 8)}-${d.slice(8, 12)}-${d.slice(12, 16)}-${d.slice(16)}`
  return `${d.slice(0, 8)}-${d.slice(8, 12)}-${d.slice(12, 16)}-${d.slice(16, 20)}-${d.slice(20)}`
}

function aplicarMascaraPix(tipo: string, valor: string): string {
  if (tipo === 'cpf') return mascaraCPF(valor)
  if (tipo === 'cnpj') return mascaraCNPJ(valor)
  if (tipo === 'email') return valor.toLowerCase().replace(/\s/g, '')
  if (tipo === 'telefone') return mascaraTelefone(valor)
  if (tipo === 'aleatoria') return mascaraAleatoria(valor)
  if (tipo === 'dex') return mascaraTelefone(valor)
  return valor
}

const PIX_PLACEHOLDER: Record<string, string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  email: 'joao@exemplo.com',
  telefone: '(11) 99999-9999',
  aleatoria: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  dex: '(11) 99999-9999',
}

const DEFAULTS: FormData = {
  nome: '',
  email: '',
  setor: '',
  funcao: '',
  data_inicio: '',
  contrato: 'BRL',
  cripto_moeda: 'USDT',
  salario_base: 0,
  dia_pagamento: 5,
  carteira_cripto: '',
  rede_cripto: '',
  chave_pix: '',
  tipo_chave_pix: '',
  ativo: true,
}

interface Props {
  isOpen: boolean
  onClose: () => void
  prestador: Prestador | null
}

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

export default function PrestadorFormDialog({ isOpen, onClose, prestador }: Props) {
  const isEditing = prestador !== null
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: DEFAULTS,
  })

  const contrato = form.watch('contrato')
  const cripto_moeda = form.watch('cripto_moeda')
  const ativo = form.watch('ativo')
  const tipoChavePix = form.watch('tipo_chave_pix') ?? ''

  useEffect(() => {
    if (!isOpen) return
    if (prestador) {
      form.reset({
        nome: prestador.nome,
        email: prestador.email,
        setor: prestador.setor,
        funcao: prestador.funcao,
        data_inicio: prestador.data_inicio,
        contrato: prestador.contrato,
        cripto_moeda: prestador.cripto_moeda ?? 'USDT',
        salario_base: prestador.salario_base,
        dia_pagamento: prestador.dia_pagamento,
        carteira_cripto: prestador.carteira_cripto ?? '',
        rede_cripto: prestador.rede_cripto ?? '',
        chave_pix: prestador.chave_pix ?? '',
        tipo_chave_pix: prestador.tipo_chave_pix ?? '',
        ativo: prestador.ativo,
      })
    } else {
      form.reset(DEFAULTS)
    }
    setServerError(null)
  }, [isOpen, prestador, form])

  // Only clear validation errors when switching contract type — preserve field values
  // so they reappear if the user switches back
  useEffect(() => {
    if (contrato === 'BRL') {
      form.clearErrors(['carteira_cripto', 'rede_cripto'])
    } else {
      form.clearErrors(['chave_pix', 'tipo_chave_pix'])
    }
  }, [contrato, form])

  function onSubmit(data: FormData) {
    setServerError(null)
    const input: PrestadorInput = {
      nome: data.nome,
      email: data.email,
      setor: data.setor,
      funcao: data.funcao,
      data_inicio: data.data_inicio,
      contrato: data.contrato,
      cripto_moeda: data.contrato !== 'BRL' ? data.cripto_moeda : 'USDT',
      salario_base: data.salario_base,
      dia_pagamento: data.dia_pagamento,
      carteira_cripto: data.carteira_cripto?.trim() || null,
      rede_cripto: data.rede_cripto?.trim() || null,
      chave_pix: data.chave_pix?.trim() || null,
      tipo_chave_pix: (data.tipo_chave_pix?.trim() || null) as TipoChavePix | null,
      ativo: data.ativo,
    }

    startTransition(async () => {
      try {
        if (isEditing && prestador) {
          await atualizarPrestador(prestador.id, input)
        } else {
          await criarPrestador(input)
        }
        onClose()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.')
      }
    })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {isEditing ? 'Editar Prestador' : 'Novo Prestador'}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="p-6 space-y-5">

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Nome completo <span className="text-destructive">*</span>
                </label>
                <input
                  {...form.register('nome')}
                  placeholder="João da Silva"
                  className={inputClass}
                />
                <FieldError message={form.formState.errors.nome?.message} />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  {...form.register('email')}
                  type="email"
                  placeholder="joao@exemplo.com"
                  className={inputClass}
                />
                <FieldError message={form.formState.errors.email?.message} />
              </div>

              {/* Setor / Função */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Setor <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...form.register('setor')}
                    placeholder="Tecnologia"
                    className={inputClass}
                  />
                  <FieldError message={form.formState.errors.setor?.message} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Função <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...form.register('funcao')}
                    placeholder="Desenvolvedor"
                    className={inputClass}
                  />
                  <FieldError message={form.formState.errors.funcao?.message} />
                </div>
              </div>

              {/* Data de início / Dia de pagamento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Data de início <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...form.register('data_inicio')}
                    type="date"
                    className={inputClass}
                  />
                  <FieldError message={form.formState.errors.data_inicio?.message} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Dia de pagamento <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...form.register('dia_pagamento')}
                    type="number"
                    min={1}
                    max={31}
                    placeholder="5"
                    className={inputClass}
                  />
                  <FieldError message={form.formState.errors.dia_pagamento?.message} />
                </div>
              </div>

              {/* Tipo de contrato */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Tipo de contrato <span className="text-destructive">*</span>
                </label>
                <select
                  {...form.register('contrato')}
                  className={inputClass}
                >
                  <option value="BRL">BRL — Valor em reais, pago em reais</option>
                  <option value="USDT">USD — Valor e pagamento em cripto</option>
                  <option value="USDT/BRL">USD/BRL — Valor em reais, convertido para cripto no pagamento</option>
                </select>
              </div>

              {/* Cripto de pagamento — visível quando contrato é cripto */}
              {contrato !== 'BRL' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Cripto de pagamento <span className="text-destructive">*</span>
                  </label>
                  <select {...form.register('cripto_moeda')} className={inputClass}>
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
              )}

              {/* Salário base */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {contrato === 'USDT' ? `Salário base (${cripto_moeda})` : 'Salário base (R$)'}{' '}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  {...form.register('salario_base')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className={inputClass}
                />
                {contrato === 'USDT/BRL' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    O valor em R$ será convertido para {cripto_moeda} na data do pagamento.
                  </p>
                )}
                <FieldError message={form.formState.errors.salario_base?.message} />
              </div>

              {/* Carteira cripto (USDT ou USDT/BRL) */}
              {contrato !== 'BRL' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Carteira cripto <span className="text-destructive">*</span>
                    </label>
                    <input
                      {...form.register('carteira_cripto')}
                      placeholder="0x..."
                      className={`${inputClass} font-mono`}
                    />
                    <FieldError message={form.formState.errors.carteira_cripto?.message} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Rede <span className="text-destructive">*</span>
                    </label>
                    <input
                      {...form.register('rede_cripto')}
                      placeholder="TRC20, ERC20, BEP20..."
                      className={inputClass}
                    />
                    <FieldError message={form.formState.errors.rede_cripto?.message} />
                  </div>
                </div>
              )}

              {/* Chave PIX (BRL) */}
              {contrato === 'BRL' && (
                <div className="grid grid-cols-[180px_1fr] gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Tipo de chave <span className="text-destructive">*</span>
                    </label>
                    <select
                      {...form.register('tipo_chave_pix')}
                      onChange={(e) => {
                        form.setValue('tipo_chave_pix', e.target.value, { shouldValidate: form.formState.isSubmitted })
                        form.setValue('chave_pix', '')
                        form.clearErrors('chave_pix')
                      }}
                      className={inputClass}
                    >
                      <option value="">Selecione</option>
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="telefone">Telefone</option>
                      <option value="aleatoria">Aleatória</option>
                      <option value="dex">DEX</option>
                    </select>
                    <FieldError message={form.formState.errors.tipo_chave_pix?.message} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      {tipoChavePix === 'dex' ? 'Chave DEX' : 'Chave PIX'} <span className="text-destructive">*</span>
                    </label>
                    <input
                      {...form.register('chave_pix')}
                      value={form.watch('chave_pix') || ''}
                      onChange={(e) => {
                        const val = aplicarMascaraPix(tipoChavePix, e.target.value)
                        form.setValue('chave_pix', val, { shouldValidate: form.formState.isSubmitted })
                      }}
                      placeholder={PIX_PLACEHOLDER[tipoChavePix] ?? 'Selecione o tipo primeiro'}
                      disabled={!tipoChavePix}
                      className={inputClass}
                    />
                    <FieldError message={form.formState.errors.chave_pix?.message} />
                  </div>
                </div>
              )}

              {/* Status (ativo/inativo) */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Prestador ativo</p>
                  <p className="text-xs text-muted-foreground">
                    Prestadores inativos não entram nos cálculos de pagamento
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => form.setValue('ativo', !ativo)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    ativo ? 'bg-foreground' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                      ativo ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Erro do servidor */}
              {serverError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {serverError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/80 transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Salvar alterações' : 'Cadastrar prestador'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </>
  )
}
