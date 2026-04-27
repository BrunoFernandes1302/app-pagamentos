-- Armazena os IDs das parcelas de empréstimo descontadas no pagamento de salário
-- Permite reverter exatamente as parcelas certas ao excluir o pagamento
ALTER TABLE historico_pagamentos ADD COLUMN parcelas_emprestimo_ids UUID[];
