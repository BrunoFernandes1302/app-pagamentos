-- O valor da comissão passa a ser calculado dinamicamente na tela
-- e só é gravado no momento do registro do pagamento.
ALTER TABLE comissao_prestadores
  ALTER COLUMN valor_comissao DROP NOT NULL;
