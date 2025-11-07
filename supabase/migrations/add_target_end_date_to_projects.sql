-- Migration: Adicionar campo target_end_date à tabela projects
-- Descrição: Campo para armazenar a data alvo/limite desejada para conclusão do projeto
-- Data: 2025-11-06

-- Adicionar coluna target_end_date
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS target_end_date TIMESTAMP WITH TIME ZONE;

-- Comentário explicativo
COMMENT ON COLUMN projects.target_end_date IS 'Data alvo/limite desejada para conclusão do projeto. Diferente de end_date que é calculado automaticamente pela última tarefa + buffer.';
