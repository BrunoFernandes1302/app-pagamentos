import { describe, it, expect } from 'vitest'
import { calcularProximaApos } from './recorrencia'

// Helper para criar datas sem ambiguidade de fuso horário
function d(yyyy: number, mm: number, dd: number) {
  return new Date(yyyy, mm - 1, dd, 12, 0, 0)
}

describe('calcularProximaApos — dia_mes', () => {
  it('retorna o dia pedido no mês corrente quando ainda não passou', () => {
    // Hoje é dia 10; próxima recorrência é dia 20 do mesmo mês
    expect(calcularProximaApos('dia_mes', 20, d(2025, 6, 10))).toBe('2025-06-20')
  })

  it('avança para o mês seguinte quando o dia já passou', () => {
    // Hoje é dia 25; dia 10 já passou → próximo mês
    expect(calcularProximaApos('dia_mes', 10, d(2025, 6, 25))).toBe('2025-07-10')
  })

  it('avança para o mês seguinte quando o dia é exatamente hoje', () => {
    // Hoje é dia 15; dia 15 = hoje → não conta, vai pro próximo mês
    expect(calcularProximaApos('dia_mes', 15, d(2025, 6, 15))).toBe('2025-07-15')
  })

  it('trata a virada de ano corretamente', () => {
    // Hoje é 20/dez; dia 5 já passou → próximo é 5/jan do ano seguinte
    expect(calcularProximaApos('dia_mes', 5, d(2025, 12, 20))).toBe('2026-01-05')
  })
})

describe('calcularProximaApos — dia_semana', () => {
  // 2025-06-02 é segunda-feira (getDay() === 1)
  it('retorna a próxima segunda quando hoje é segunda', () => {
    // Mesmo dia da semana → avança 7 dias
    expect(calcularProximaApos('dia_semana', 1, d(2025, 6, 2))).toBe('2025-06-09')
  })

  it('retorna a quarta mais próxima quando hoje é segunda', () => {
    // Segunda → quarta = 2 dias à frente
    expect(calcularProximaApos('dia_semana', 3, d(2025, 6, 2))).toBe('2025-06-04')
  })

  it('retorna a sexta mais próxima quando hoje é segunda', () => {
    // Segunda → sexta = 4 dias à frente
    expect(calcularProximaApos('dia_semana', 5, d(2025, 6, 2))).toBe('2025-06-06')
  })

  it('traversa a virada de semana corretamente (dom → seg)', () => {
    // 2025-06-08 é domingo (0); próxima segunda (1) = 1 dia à frente
    expect(calcularProximaApos('dia_semana', 1, d(2025, 6, 8))).toBe('2025-06-09')
  })
})
