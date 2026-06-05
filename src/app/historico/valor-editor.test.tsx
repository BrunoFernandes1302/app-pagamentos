// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ValorEditor from './valor-editor'

// Mock da server action — o componente importa de './actions', então
// interceptamos o módulo inteiro antes de qualquer teste rodar.
vi.mock('./actions', () => ({
  atualizarValor: vi.fn().mockResolvedValue(undefined),
}))

import { atualizarValor } from './actions'
const mockAtualizarValor = vi.mocked(atualizarValor)

beforeEach(() => {
  mockAtualizarValor.mockClear()
})

describe('ValorEditor', () => {
  it('exibe o valor formatado em BRL no modo leitura', () => {
    render(<ValorEditor id="1" valor={1500} moeda="BRL" />)
    // Intl.NumberFormat usa espaço não-quebrável (U+00A0) após "R$" — regex cobre os dois
    expect(screen.getByText(/R\$\s1\.500,00/)).toBeInTheDocument()
  })

  it('exibe o valor formatado em USDC no modo leitura', () => {
    render(<ValorEditor id="1" valor={666.6667} moeda="USDC" />)
    expect(screen.getByText('666,6667 USDC')).toBeInTheDocument()
  })

  it('abre o input ao clicar no valor', () => {
    render(<ValorEditor id="1" valor={1000} moeda="BRL" />)
    fireEvent.click(screen.getByTitle('Editar valor'))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('fecha o input sem salvar ao pressionar Escape', () => {
    render(<ValorEditor id="1" valor={1000} moeda="BRL" />)
    fireEvent.click(screen.getByTitle('Editar valor'))
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Escape' })
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(mockAtualizarValor).not.toHaveBeenCalled()
  })

  it('fecha o input sem salvar ao clicar em Cancelar', () => {
    render(<ValorEditor id="1" valor={1000} moeda="BRL" />)
    fireEvent.click(screen.getByTitle('Editar valor'))
    fireEvent.click(screen.getByTitle('Cancelar'))
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(mockAtualizarValor).not.toHaveBeenCalled()
  })

  it('chama atualizarValor com o novo valor ao pressionar Enter', async () => {
    render(<ValorEditor id="abc" valor={1000} moeda="USDT" />)
    fireEvent.click(screen.getByTitle('Editar valor'))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '1234.5678' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(mockAtualizarValor).toHaveBeenCalledWith('abc', 1234.5678))
  })

  it('chama atualizarValor ao clicar no botão Salvar', async () => {
    render(<ValorEditor id="xyz" valor={500} moeda="BRL" />)
    fireEvent.click(screen.getByTitle('Editar valor'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '750' } })
    fireEvent.click(screen.getByTitle('Salvar'))
    await waitFor(() => expect(mockAtualizarValor).toHaveBeenCalledWith('xyz', 750))
  })

  it('não chama atualizarValor se o valor for zero ou inválido', () => {
    render(<ValorEditor id="1" valor={1000} moeda="BRL" />)
    fireEvent.click(screen.getByTitle('Editar valor'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' })
    expect(mockAtualizarValor).not.toHaveBeenCalled()
  })

  it('usa step 0.01 para BRL', () => {
    render(<ValorEditor id="1" valor={100} moeda="BRL" />)
    fireEvent.click(screen.getByTitle('Editar valor'))
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.01')
  })

  it('usa step 0.0001 para USDT', () => {
    render(<ValorEditor id="1" valor={100} moeda="USDT" />)
    fireEvent.click(screen.getByTitle('Editar valor'))
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.0001')
  })
})
