CREATE TABLE historico_pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Origem do pagamento
  tipo TEXT NOT NULL CHECK (tipo IN ('comissao', 'salario')),
  referencia_id UUID, -- id da comissão ou do registro de salário de origem

  -- Dados do prestador denormalizados (preserva histórico mesmo se prestador for excluído)
  prestador_id UUID REFERENCES prestadores(id) ON DELETE SET NULL,
  prestador_nome TEXT NOT NULL,

  -- Dados do pagamento
  descricao TEXT NOT NULL,
  valor NUMERIC(15, 2) NOT NULL,
  moeda TEXT NOT NULL CHECK (moeda IN ('USDT', 'BRL')),

  -- Comprovante: HASH da transação (USDT) ou identificador do comprovante PIX (BRL)
  comprovante TEXT,

  -- Mês de referência armazenado como primeiro dia do mês (ex: 2026-02-01)
  mes_referencia DATE NOT NULL,

  pago_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX historico_pagamentos_mes_idx ON historico_pagamentos (mes_referencia);
CREATE INDEX historico_pagamentos_prestador_idx ON historico_pagamentos (prestador_id);

ALTER TABLE historico_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON historico_pagamentos FOR ALL USING (true) WITH CHECK (true);
