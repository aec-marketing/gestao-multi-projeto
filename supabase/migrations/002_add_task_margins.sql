-- Adicionar campos de margem (padding) para tarefas principais
-- Esses campos permitem adicionar folga antes e depois das subtarefas

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS margin_start NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS margin_end NUMERIC DEFAULT 0;

COMMENT ON COLUMN tasks.margin_start IS 'Dias de folga adicionados antes das subtarefas (margem de início)';
COMMENT ON COLUMN tasks.margin_end IS 'Dias de folga adicionados depois das subtarefas (margem de fim)';
