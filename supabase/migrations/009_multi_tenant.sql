-- ============================================================
-- Multi-tenant: organizations + profiles + RLS por organização
-- ============================================================

-- Tabela de organizações
CREATE TABLE organizations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Tabela de perfis (liga auth.users a uma organização + role)
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super_admin', 'admin', 'member')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Funções helper (SECURITY DEFINER = bypassam RLS, rodam como owner)
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Função para admins listarem usuários com email
CREATE OR REPLACE FUNCTION get_users_for_admin()
RETURNS TABLE (
  id              UUID,
  email           TEXT,
  nome            TEXT,
  role            TEXT,
  organization_id UUID,
  org_nome        TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    p.id,
    u.email,
    p.nome,
    p.role,
    p.organization_id,
    o.nome AS org_nome,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  JOIN public.organizations o ON p.organization_id = o.id
  WHERE (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  ORDER BY p.created_at DESC
$$;

-- ============================================================
-- Organização padrão para os dados existentes
-- ============================================================
INSERT INTO organizations (id, nome)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Ether Private Bank');

-- ============================================================
-- Adicionar organization_id em todas as tabelas existentes
-- ============================================================
ALTER TABLE prestadores         ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE comissoes            ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE comissao_prestadores ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE historico_pagamentos ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE emprestimos          ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE parcelas_emprestimo  ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE progressao_salarial  ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Migrar dados existentes para a organização padrão
UPDATE prestadores         SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE comissoes            SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE comissao_prestadores SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE historico_pagamentos SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE emprestimos          SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE parcelas_emprestimo  SET organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE progressao_salarial  SET organization_id = '00000000-0000-0000-0000-000000000001';

-- Tornar NOT NULL após migração
ALTER TABLE prestadores         ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE comissoes            ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE comissao_prestadores ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE historico_pagamentos ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE emprestimos          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE parcelas_emprestimo  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE progressao_salarial  ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================
-- Remover policies antigas permissivas
-- ============================================================
DROP POLICY IF EXISTS "allow_all" ON prestadores;
DROP POLICY IF EXISTS "allow_all" ON historico_pagamentos;
DROP POLICY IF EXISTS "Acesso total autenticado" ON emprestimos;
DROP POLICY IF EXISTS "Acesso total autenticado" ON parcelas_emprestimo;
DROP POLICY IF EXISTS "Acesso total autenticado" ON progressao_salarial;

-- Garantir que RLS está habilitado (comissoes/comissao_prestadores podem não ter)
ALTER TABLE comissoes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissao_prestadores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Novas RLS policies — isolamento por organização
-- ============================================================
CREATE POLICY "org_isolation" ON prestadores
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "org_isolation" ON comissoes
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "org_isolation" ON comissao_prestadores
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "org_isolation" ON historico_pagamentos
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "org_isolation" ON emprestimos
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "org_isolation" ON parcelas_emprestimo
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "org_isolation" ON progressao_salarial
  FOR ALL USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

-- ============================================================
-- RLS para as novas tabelas
-- ============================================================

-- Organizations: membros veem só a própria org; super_admin vê tudo
CREATE POLICY "members_read_own_org" ON organizations
  FOR SELECT USING (id = get_user_org_id());

CREATE POLICY "super_admin_manage_orgs" ON organizations
  FOR ALL USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

-- Profiles: usuário vê o próprio perfil e os da sua org; super_admin gerencia tudo
CREATE POLICY "own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "org_profiles" ON profiles
  FOR SELECT USING (organization_id = get_user_org_id());

CREATE POLICY "super_admin_profiles" ON profiles
  FOR ALL USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

-- ============================================================
-- Índices de performance
-- ============================================================
CREATE INDEX idx_profiles_org        ON profiles(organization_id);
CREATE INDEX idx_prestadores_org     ON prestadores(organization_id);
CREATE INDEX idx_comissoes_org       ON comissoes(organization_id);
CREATE INDEX idx_cp_org              ON comissao_prestadores(organization_id);
CREATE INDEX idx_historico_org       ON historico_pagamentos(organization_id);
CREATE INDEX idx_emprestimos_org     ON emprestimos(organization_id);
CREATE INDEX idx_parcelas_org        ON parcelas_emprestimo(organization_id);
CREATE INDEX idx_progressao_org      ON progressao_salarial(organization_id);

-- ============================================================
-- INSTRUÇÕES PARA O PRIMEIRO USUÁRIO ADMIN
-- ============================================================
-- Após rodar esta migration, crie seu usuário no Supabase Auth dashboard
-- (Authentication > Users > Add user), depois execute no SQL Editor:
--
--   INSERT INTO profiles (id, organization_id, nome, role)
--   VALUES (
--     '<cole-aqui-o-uuid-do-seu-usuario>',
--     '00000000-0000-0000-0000-000000000001',
--     'Bruno',
--     'super_admin'
--   );
--
-- Após isso, você poderá criar outros usuários e organizações pelo painel /admin.
-- ============================================================
