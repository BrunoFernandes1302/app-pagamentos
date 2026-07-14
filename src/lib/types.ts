export type TipoContrato = 'USDT' | 'USDT/BRL' | 'BRL'
export type CriptoMoeda = 'USDT' | 'USDC'

export const CONTRATO_LABEL: Record<TipoContrato, string> = {
  USDT: 'USD',
  'USDT/BRL': 'USD/BRL',
  BRL: 'BRL',
}

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | 'dex'

export const TIPO_PIX_LABEL: Record<TipoChavePix, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Aleatória',
  dex: 'DEX',
}

export type UserRole = 'super_admin' | 'admin' | 'member'

export interface Organization {
  id: string
  nome: string
  created_at: string
}

export interface Profile {
  id: string
  organization_id: string
  nome: string
  role: UserRole
  created_at: string
}

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
  cripto_moeda: CriptoMoeda
  chave_pix: string | null
  tipo_chave_pix: TipoChavePix | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type PrestadorInput = Omit<Prestador, 'id' | 'created_at' | 'updated_at'>

export type MoedaSimples = 'USDT' | 'USDC' | 'BRL'

export interface PrestadorResumido {
  id: string
  nome: string
  ativo: boolean
  carteira_cripto: string | null
  rede_cripto: string | null
  cripto_moeda: CriptoMoeda
  chave_pix: string | null
  tipo_chave_pix: TipoChavePix | null
}

export interface ComissaoPrestador {
  id: string
  comissao_id: string
  prestador_id: string
  percentual: number
  moeda_recebimento: MoedaSimples
  valor_comissao: number | null
  pago: boolean
  nota_fiscal: boolean
  created_at: string
  prestadores: {
    nome: string
    contrato: TipoContrato
    carteira_cripto: string | null
    rede_cripto: string | null
    cripto_moeda: CriptoMoeda
    chave_pix: string | null
    tipo_chave_pix: TipoChavePix | null
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
  nota_fiscal: boolean
  email_enviado: boolean
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
  // Parcelada
  grupo_id: string | null
  parcela_num: number | null
  total_parcelas: number | null
  // Recorrente
  recorrente: boolean
  recorrencia_tipo: 'dia_mes' | 'dia_semana' | null
  recorrencia_valor: number | null
  recorrencia_ativa: boolean
  recorrencia_origem_id: string | null
  proxima_recorrencia: string | null
}

export type StatusProgressao = 'ativo' | 'concluido' | 'cancelado'

export interface ProgressaoSalarial {
  id: string
  prestador_id: string
  salario_inicial: number
  incremento: number
  salario_alvo: number
  mes_inicio: string // 'YYYY-MM-DD'
  status: StatusProgressao
  created_at: string
  prestadores?: { nome: string; contrato: TipoContrato; cripto_moeda: CriptoMoeda }
}

export type StatusEmprestimo = 'ativo' | 'quitado' | 'cancelado'
export type StatusParcela = 'pendente' | 'paga' | 'adiantada' | 'quitada_avulso'
export type TipoPagamentoParcela = 'desconto_normal' | 'adiantamento' | 'pagamento_avulso'
export type ModoMultiplosEmprestimos = 'sequencial' | 'acumulado'

export interface ParcelaEmprestimo {
  id: string
  emprestimo_id: string
  numero_parcela: number
  valor: number
  moeda: MoedaSimples
  mes_referencia: string
  status: StatusParcela
  tipo_pagamento: TipoPagamentoParcela | null
  data_pagamento: string | null
  created_at: string
}

export interface Emprestimo {
  id: string
  prestador_id: string
  valor_total: number
  numero_parcelas: number
  valor_parcela: number
  moeda: MoedaSimples
  mes_inicio: string
  status: StatusEmprestimo
  observacoes: string | null
  created_at: string
  prestadores?: { nome: string }
  parcelas_emprestimo?: ParcelaEmprestimo[]
}
