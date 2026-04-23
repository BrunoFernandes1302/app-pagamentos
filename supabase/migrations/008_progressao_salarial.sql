-- Tabela de progressão salarial
CREATE TABLE IF NOT EXISTS progressao_salarial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id    UUID NOT NULL REFERENCES prestadores(id) ON DELETE RESTRICT,
  salario_inicial NUMERIC(12, 2) NOT NULL,
  incremento      NUMERIC(12, 2) NOT NULL,
  salario_alvo    NUMERIC(12, 2) NOT NULL,
  mes_inicio      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'concluido', 'cancelado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas uma progressão ativa por prestador
CREATE UNIQUE INDEX IF NOT EXISTS idx_progressao_prestador_ativo
  ON progressao_salarial(prestador_id)
  WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS idx_progressao_status ON progressao_salarial(status);

-- RLS
ALTER TABLE progressao_salarial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total autenticado" ON progressao_salarial
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
