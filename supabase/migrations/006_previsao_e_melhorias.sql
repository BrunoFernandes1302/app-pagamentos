-- Previsão de pagamento nas comissões
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS previsao_pagamento DATE;

-- Vínculo com comissao_prestadores no histórico (para reverter pago ao excluir)
ALTER TABLE historico_pagamentos ADD COLUMN IF NOT EXISTS comissao_prestador_id UUID;
