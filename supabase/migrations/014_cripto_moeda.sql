-- Add cripto_moeda field to prestadores (USDT or USDC preference)
ALTER TABLE prestadores
ADD COLUMN IF NOT EXISTS cripto_moeda TEXT NOT NULL DEFAULT 'USDT'
CHECK (cripto_moeda IN ('USDT', 'USDC'));

-- Extend moeda_recebimento CHECK in comissao_prestadores to include USDC
ALTER TABLE comissao_prestadores
DROP CONSTRAINT IF EXISTS comissao_prestadores_moeda_recebimento_check;
ALTER TABLE comissao_prestadores
ADD CONSTRAINT comissao_prestadores_moeda_recebimento_check
CHECK (moeda_recebimento IN ('BRL', 'USDT', 'USDC'));

-- Extend moeda CHECK in historico_pagamentos to include USDC
ALTER TABLE historico_pagamentos
DROP CONSTRAINT IF EXISTS historico_pagamentos_moeda_check;
ALTER TABLE historico_pagamentos
ADD CONSTRAINT historico_pagamentos_moeda_check
CHECK (moeda IN ('USDT', 'USDC', 'BRL'));

-- Extend moeda CHECK in emprestimos to include USDC
ALTER TABLE emprestimos
DROP CONSTRAINT IF EXISTS emprestimos_moeda_check;
ALTER TABLE emprestimos
ADD CONSTRAINT emprestimos_moeda_check
CHECK (moeda IN ('BRL', 'USDT', 'USDC'));

-- Extend moeda CHECK in parcelas_emprestimo to include USDC
ALTER TABLE parcelas_emprestimo
DROP CONSTRAINT IF EXISTS parcelas_emprestimo_moeda_check;
ALTER TABLE parcelas_emprestimo
ADD CONSTRAINT parcelas_emprestimo_moeda_check
CHECK (moeda IN ('BRL', 'USDT', 'USDC'));
