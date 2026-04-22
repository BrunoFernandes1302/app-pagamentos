'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import { criarPrestador, atualizarPrestador } from './actions'
import type { Prestador, PrestadorInput } from '@/lib/types'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  setor: z.string().min(1, 'Setor obrigatório'),
  funcao: z.string().min(1, 'Função obrigatória'),
  data_inicio: z.string().min(1, 'Data de início obrigatória'),
  contrato: z.enum(['USDT', 'USDT/BRL', 'BRL']),
  salario_base: z.coerce.number().positive('Deve ser maior que zero'),
  dia_pagamento: z.coerce.number().int().min(1, 'Mínimo 1').max(31, 'Máximo 31'),
  carteira_cripto: z.string().optional(),
  rede_cripto: z.string().optional(),
  chave_pix: z.string().optional(),
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
    if (!data.chave_pix?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['chave_pix'], message: 'Chave PIX obrigatória' })
    }
  }
})

type FormData = z.infer<typeof schema>

const DEFAULTS: FormData = {
  nome: '',
  email: '',
  setor: '',
  funcao: '',
  data_inicio: '',
  contrato: 'BRL',
  salario_base: 0,
  dia_pagamento: 5,
  carteira_cripto: '',
  rede_cripto: '',
  chave_pix: '',
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
  const ativo = form.watch('ativo')

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
        salario_base: prestador.salario_base,
        dia_pagamento: prestador.dia_pagamento,
        carteira_cripto: prestador.carteira_cripto ?? '',
        rede_cripto: prestador.rede_cripto ?? '',
        chave_pix: prestador.chave_pix ?? '',
        ativo: prestador.ativo,
      })
    } else {
      form.reset(DEFAULTS)
    }
    setServerError(null)
  }, [isOpen, prestador, form])

  // Clear irrelevant payment fields when contract type changes
  useEffect(() => {
    if (contrato === 'BRL') {
      form.setValue('carteira_cripto', '')
      form.setValue('rede_cripto', '')
      form.clearErrors(['carteira_cripto', 'rede_cripto'])
    } else {
      form.setValue('chave_pix', '')
      form.clearErrors('chave_pix')
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
      salario_base: data.salario_base,
      dia_pagamento: data.dia_pagamento,
      carteira_cripto: data.contrato !== 'BRL' ? (data.carteira_cripto?.trim() || null) : null,
      rede_cripto: data.contrato !== 'BRL' ? (data.rede_cripto?.trim() || null) : null,
      chave_pix: data.contrato === 'BRL' ? (data.chave_pix?.trim() || null) : null,
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
                  <option value="USDT">USDT — Valor e pagamento em USDT</option>
                  <option value="USDT/BRL">USDT/BRL — Valor em reais, convertido para USDT no pagamento</option>
                </select>
              </div>

              {/* Salário base */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {contrato === 'USDT' ? 'Salário base (USDT)' : 'Salário base (R$)'}{' '}
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
                    O valor em R$ será convertido para USDT na data do pagamento.
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
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Chave PIX <span className="text-destructive">*</span>
                  </label>
                  <input
                    {...form.register('chave_pix')}
                    placeholder="CPF, email, telefone ou chave aleatória"
                    className={inputClass}
                  />
                  <FieldError message={form.formState.errors.chave_pix?.message} />
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
