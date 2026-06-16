-- ============================================================
-- Fix: Garante RLS habilitado em todas as tabelas públicas
-- Usa DROP + CREATE (compatível com PG < 15)
-- ============================================================

-- Habilitar RLS (idempotente — não falha se já estiver ativo)
ALTER TABLE prestadores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissao_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_emprestimo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE progressao_salarial  ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Recriar políticas de isolamento por org (drop + create é idempotente)
-- ============================================================

DROP POLICY IF EXISTS "org_isolation" ON prestadores;
CREATE POLICY "org_isolation" ON prestadores
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "org_isolation" ON comissoes;
CREATE POLICY "org_isolation" ON comissoes
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "org_isolation" ON comissao_prestadores;
CREATE POLICY "org_isolation" ON comissao_prestadores
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "org_isolation" ON historico_pagamentos;
CREATE POLICY "org_isolation" ON historico_pagamentos
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "org_isolation" ON emprestimos;
CREATE POLICY "org_isolation" ON emprestimos
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "org_isolation" ON parcelas_emprestimo;
CREATE POLICY "org_isolation" ON parcelas_emprestimo
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "org_isolation" ON progressao_salarial;
CREATE POLICY "org_isolation" ON progressao_salarial
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

-- organizations
DROP POLICY IF EXISTS "members_read_own_org" ON organizations;
CREATE POLICY "members_read_own_org" ON organizations
  FOR SELECT USING (id = get_user_org_id());

DROP POLICY IF EXISTS "super_admin_manage_orgs" ON organizations;
CREATE POLICY "super_admin_manage_orgs" ON organizations
  FOR ALL USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

-- profiles
DROP POLICY IF EXISTS "own_profile" ON profiles;
CREATE POLICY "own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "org_profiles" ON profiles;
CREATE POLICY "org_profiles" ON profiles
  FOR SELECT USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "super_admin_profiles" ON profiles;
CREATE POLICY "super_admin_profiles" ON profiles
  FOR ALL USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');
