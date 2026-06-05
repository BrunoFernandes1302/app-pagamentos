import { describe, it, expect } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('retorna string vazia para array vazio', () => {
    expect(toCsv([])).toBe('')
  })

  it('gera cabeçalho e linha corretamente', () => {
    const rows = [{ nome: 'Bruno', valor: 1000 }]
    expect(toCsv(rows)).toBe('nome,valor\nBruno,1000')
  })

  it('gera múltiplas linhas na ordem certa', () => {
    const rows = [
      { nome: 'Bruno', valor: 1000 },
      { nome: 'Deyci', valor: 2000 },
    ]
    expect(toCsv(rows)).toBe('nome,valor\nBruno,1000\nDeyci,2000')
  })

  it('escapa valor com vírgula entre aspas duplas', () => {
    const rows = [{ descricao: 'Salário, mensal' }]
    expect(toCsv(rows)).toBe('descricao\n"Salário, mensal"')
  })

  it('escapa aspas duplas internas dobrando-as', () => {
    const rows = [{ obs: 'dito "assim"' }]
    expect(toCsv(rows)).toBe('obs\n"dito ""assim"""')
  })

  it('escapa valor com quebra de linha', () => {
    const rows = [{ obs: 'linha1\nlinha2' }]
    expect(toCsv(rows)).toBe('obs\n"linha1\nlinha2"')
  })

  it('trata null e undefined como string vazia', () => {
    const rows = [{ a: null, b: undefined }]
    expect(toCsv(rows)).toBe('a,b\n,')
  })

  it('usa as colunas do primeiro objeto (ignora chaves extras nos outros)', () => {
    const rows = [
      { a: 1, b: 2 },
      { a: 3, b: 4, c: 5 },
    ]
    expect(toCsv(rows)).toBe('a,b\n1,2\n3,4')
  })
})
