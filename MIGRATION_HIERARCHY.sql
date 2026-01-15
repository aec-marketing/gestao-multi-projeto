-- ============================================
-- MIGRATION - Separar Hierarquia de Função
-- Execute no Supabase SQL Editor
-- ============================================

-- IMPORTANTE: Esta migration separa o conceito de hierarquia (funcional)
-- da função/especialidade (visual)

-- 1. Adicionar campo 'hierarchy' (hierarquia funcional)
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS hierarchy TEXT CHECK (hierarchy IN ('gerente', 'lider', 'operador'));

COMMENT ON COLUMN resources.hierarchy IS 'Hierarquia funcional do recurso (gerente/lider/operador) - determina permissões e vínculos';
COMMENT ON COLUMN resources.role IS 'Função/especialidade do recurso (texto livre) - apenas visual (ex: Engenheiro de Segurança, PCP, Soldador)';

-- 2. Migrar dados existentes de 'role' para 'hierarchy'
-- Se role era 'gerente', 'lider' ou 'operador', copiar para hierarchy
UPDATE resources
SET hierarchy = role
WHERE role IN ('gerente', 'lider', 'operador');

-- 3. Limpar o campo 'role' onde era hierarquia (não especialidade)
-- Isso deixa role NULL para que o usuário possa adicionar a especialidade depois
UPDATE resources
SET role = NULL
WHERE role IN ('gerente', 'lider', 'operador');

-- 4. Definir hierarquia padrão para recursos sem hierarquia
-- Todos os recursos devem ter uma hierarquia
UPDATE resources
SET hierarchy = 'operador'
WHERE hierarchy IS NULL;

-- 5. Tornar hierarchy obrigatório
ALTER TABLE resources
ALTER COLUMN hierarchy SET NOT NULL;

-- 6. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_resources_hierarchy ON resources(hierarchy);

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar a estrutura das colunas
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'resources'
  AND column_name IN ('hierarchy', 'role', 'leader_id')
ORDER BY column_name;

-- Verificar distribuição de hierarquias
SELECT
    hierarchy,
    COUNT(*) as total,
    COUNT(role) as com_funcao,
    COUNT(*) - COUNT(role) as sem_funcao
FROM resources
WHERE is_active = true
GROUP BY hierarchy
ORDER BY
    CASE hierarchy
        WHEN 'gerente' THEN 1
        WHEN 'lider' THEN 2
        WHEN 'operador' THEN 3
    END;

-- Ver alguns exemplos
SELECT
    name,
    hierarchy,
    role as funcao_especialidade,
    leader_id
FROM resources
WHERE is_active = true
ORDER BY
    CASE hierarchy
        WHEN 'gerente' THEN 1
        WHEN 'lider' THEN 2
        WHEN 'operador' THEN 3
    END,
    name
LIMIT 10;
