-- Migration 015: Comissão Parcelada e Recorrente
ALTER TABLE comissoes
  ADD COLUMN IF NOT EXISTS grupo_id UUID,
  ADD COLUMN IF NOT EXISTS parcela_num INT,
  ADD COLUMN IF NOT EXISTS total_parcelas INT,
  ADD COLUMN IF NOT EXISTS recorrente BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recorrencia_tipo TEXT,
  ADD COLUMN IF NOT EXISTS recorrencia_valor INT,
  ADD COLUMN IF NOT EXISTS recorrencia_ativa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS recorrencia_origem_id UUID REFERENCES comissoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proxima_recorrencia DATE;

ALTER TABLE comissoes
  ADD CONSTRAINT comissoes_recorrencia_tipo_check
  CHECK (recorrencia_tipo IN ('dia_mes', 'dia_semana'));
