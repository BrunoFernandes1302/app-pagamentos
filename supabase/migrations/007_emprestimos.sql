-- Tabela de empréstimos / adiantamentos
CREATE TABLE IF NOT EXISTS emprestimos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id    UUID NOT NULL REFERENCES prestadores(id) ON DELETE RESTRICT,
  valor_total     NUMERIC(12, 2) NOT NULL,
  numero_parcelas INTEGER NOT NULL,
  valor_parcela   NUMERIC(12, 2) NOT NULL,
  moeda           TEXT NOT NULL CHECK (moeda IN ('BRL', 'USDT')),
  mes_inicio      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'quitado', 'cancelado')),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de parcelas dos empréstimos
CREATE TABLE IF NOT EXISTS parcelas_emprestimo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emprestimo_id   UUID NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  numero_parcela  INTEGER NOT NULL,
  valor           NUMERIC(12, 2) NOT NULL,
  moeda           TEXT NOT NULL CHECK (moeda IN ('BRL', 'USDT')),
  mes_referencia  DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'adiantada', 'quitada_avulso')),
  tipo_pagamento  TEXT CHECK (tipo_pagamento IN ('desconto_normal', 'adiantamento', 'pagamento_avulso')),
  data_pagamento  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_emprestimos_prestador ON emprestimos(prestador_id);
CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos(status);
CREATE INDEX IF NOT EXISTS idx_parcelas_emprestimo_id ON parcelas_emprestimo(emprestimo_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_status ON parcelas_emprestimo(status);
CREATE INDEX IF NOT EXISTS idx_parcelas_mes ON parcelas_emprestimo(mes_referencia);


-- RLS
ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_emprestimo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total autenticado" ON emprestimos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso total autenticado" ON parcelas_emprestimo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
