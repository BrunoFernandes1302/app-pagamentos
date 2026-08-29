-- ============================================================
-- Comprovante PIX como PDF anexado (Supabase Storage)
-- ============================================================

-- Colunas de metadados do arquivo anexado em historico_pagamentos
ALTER TABLE historico_pagamentos
  ADD COLUMN comprovante_arquivo TEXT,          -- path do objeto no bucket
  ADD COLUMN comprovante_arquivo_nome TEXT,      -- nome original do arquivo
  ADD COLUMN comprovante_arquivo_tamanho BIGINT; -- tamanho em bytes

-- Garantir RLS habilitado (idempotente)
ALTER TABLE historico_pagamentos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Bucket de storage privado
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Policies do bucket — isolamento por organização via prefixo
-- O objeto é nomeado {organization_id}/{historico_id}/{arquivo}.pdf
-- ============================================================

-- Insert: só dentro da própria organização
CREATE POLICY "org_isolation_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'comprovantes'
    AND (storage.foldername(name))[1] = (SELECT get_user_org_id())::text
  );

-- Select: só da própria organização
CREATE POLICY "org_isolation_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'comprovantes'
    AND (storage.foldername(name))[1] = (SELECT get_user_org_id())::text
  );

-- Delete: só da própria organização
CREATE POLICY "org_isolation_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'comprovantes'
    AND (storage.foldername(name))[1] = (SELECT get_user_org_id())::text
  );