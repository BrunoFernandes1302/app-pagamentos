-- ============================================================
-- Upload de comprovante direto do browser para o Storage
-- ============================================================
-- A Vercel corta requisições de Function acima de 4,5 MB (limite de
-- infraestrutura, não configurável), então o PDF não pode mais trafegar pela
-- Server Action. O browser passa a enviar direto ao Storage via signed upload
-- URL, e o bucket assume a responsabilidade de impor tamanho e tipo.

UPDATE storage.buckets
SET
  file_size_limit = 20971520, -- 20 MB
  allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'comprovantes';
