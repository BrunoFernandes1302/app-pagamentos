export type TipoContrato = 'USDT' | 'USDT/BRL' | 'BRL'

export interface Prestador {
  id: string
  nome: string
  email: string
  setor: string
  funcao: string
  data_inicio: string
  contrato: TipoContrato
  salario_base: number
  dia_pagamento: number
  carteira_cripto: string | null
  rede_cripto: string | null
  chave_pix: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type PrestadorInput = Omit<Prestador, 'id' | 'created_at' | 'updated_at'>

export type MoedaSimples = 'USDT' | 'BRL'

export interface PrestadorResumido {
  id: string
  nome: string
  carteira_cripto: string | null
  rede_cripto: string | null
  chave_pix: string | null
}

export interface ComissaoPrestador {
  id: string
  comissao_id: string
  prestador_id: string
  percentual: number
  moeda_recebimento: MoedaSimples
  valor_comissao: number | null
  pago: boolean
  created_at: string
  prestadores: {
    nome: string
    carteira_cripto: string | null
    rede_cripto: string | null
    chave_pix: string | null
  }
}

export type TipoPagamento = 'comissao' | 'salario'

export interface HistoricoPagamento {
  id: string
  tipo: TipoPagamento
  referencia_id: string | null
  comissao_prestador_id: string | null
  prestador_id: string | null
  prestador_nome: string
  descricao: string
  valor: number
  moeda: MoedaSimples
  comprovante: string | null
  mes_referencia: string
  pago_em: string
  created_at: string
}

export interface Comissao {
  id: string
  tipo: string
  descricao: string
  moeda_venda: MoedaSimples
  receita_ether: number
  previsao_pagamento: string | null
  created_at: string
  updated_at: string
  comissao_prestadores: ComissaoPrestador[]
}
