CREATE TABLE prestadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  setor TEXT NOT NULL,
  funcao TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  contrato TEXT NOT NULL CHECK (contrato IN ('USDT', 'USDT/BRL', 'BRL')),
  salario_base NUMERIC(15, 2) NOT NULL,
  dia_pagamento SMALLINT NOT NULL CHECK (dia_pagamento BETWEEN 1 AND 31),
  carteira_cripto TEXT,
  rede_cripto TEXT,
  chave_pix TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER prestadores_updated_at
  BEFORE UPDATE ON prestadores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE prestadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON prestadores
  FOR ALL
  USING (true)
  WITH CHECK (true);
