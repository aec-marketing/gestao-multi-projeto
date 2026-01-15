-- ============================================
-- MIGRATION: Converter resources.role de ENUM para TEXT
-- Execute no Supabase SQL Editor
-- ============================================

-- Passo 1: Verificar o tipo atual
SELECT
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'resources'
  AND column_name = 'role';

-- Passo 2: Converter coluna para TEXT (mantendo valores existentes)
ALTER TABLE resources
ALTER COLUMN role TYPE TEXT USING role::TEXT;

-- Passo 3: Tornar a coluna nullable (para permitir recursos sem função definida)
ALTER TABLE resources
ALTER COLUMN role DROP NOT NULL;

-- Passo 4: Adicionar comentário
COMMENT ON COLUMN resources.role IS 'Função/cargo do recurso - campo texto livre (ex: Líder, Engenheiro, Operário, Eletricista, etc.)';

-- Passo 5: Verificar resultado
SELECT
    id,
    name,
    role,
    pg_typeof(role) as role_type
FROM resources
LIMIT 5;

-- Passo 6: (Opcional) Remover o tipo ENUM antigo se não for usado em mais nenhum lugar
-- IMPORTANTE: Só execute se tiver certeza que o ENUM não é usado em outras tabelas!
-- DROP TYPE IF EXISTS resource_role_enum CASCADE;
