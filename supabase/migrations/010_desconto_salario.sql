-- Adicionar 'desconto_salario' ao CHECK constraint de tipo_pagamento em parcelas_emprestimo
-- Necessário para vincular parcelas pagas via desconto de salário (resumo de pagamentos)
ALTER TABLE parcelas_emprestimo
  DROP CONSTRAINT parcelas_emprestimo_tipo_pagamento_check;

ALTER TABLE parcelas_emprestimo
  ADD CONSTRAINT parcelas_emprestimo_tipo_pagamento_check
  CHECK (tipo_pagamento IN ('desconto_normal', 'adiantamento', 'pagamento_avulso', 'desconto_salario'));
