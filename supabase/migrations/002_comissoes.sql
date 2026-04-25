-- Tabela de comissões de venda
CREATE TABLE comissoes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo          TEXT NOT NULL,
  descricao     TEXT NOT NULL,
  moeda_venda   TEXT NOT NULL CHECK (moeda_venda IN ('BRL', 'USDT')),
  receita_ether NUMERIC(15, 2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prestadores vinculados a cada comissão (N:N via tabela de junção)
CREATE TABLE comissao_prestadores (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comissao_id       UUID NOT NULL REFERENCES comissoes(id) ON DELETE CASCADE,
  prestador_id      UUID NOT NULL REFERENCES prestadores(id) ON DELETE RESTRICT,
  percentual        NUMERIC(5, 2) NOT NULL,
  moeda_recebimento TEXT NOT NULL CHECK (moeda_recebimento IN ('BRL', 'USDT')),
  valor_comissao    NUMERIC(15, 2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_comissoes_created ON comissoes(created_at DESC);
CREATE INDEX idx_cp_comissao ON comissao_prestadores(comissao_id);
CREATE INDEX idx_cp_prestador ON comissao_prestadores(prestador_id);
