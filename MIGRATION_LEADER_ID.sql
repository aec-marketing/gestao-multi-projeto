-- ============================================
-- MIGRATION - Adicionar campo leader_id
-- Execute no Supabase SQL Editor
-- ============================================

-- Adicionar campo 'leader_id' para vincular operários a líderes
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES resources(id) ON DELETE SET NULL;

COMMENT ON COLUMN resources.leader_id IS 'ID do líder responsável por este recurso (opcional)';

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar se a coluna foi adicionada
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'resources'
  AND column_name = 'leader_id';
