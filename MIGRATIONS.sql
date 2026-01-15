-- ============================================
-- MIGRATIONS - New Features
-- Execute no Supabase SQL Editor
-- ============================================

-- 1. Adicionar campo 'role' (função) na tabela resources
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS role TEXT;

COMMENT ON COLUMN resources.role IS 'Função/cargo do recurso (ex: Líder, Engenheiro, Operário, Eletricista) - campo texto livre';

-- 1b. Adicionar campo 'leader_id' para vincular operários a líderes
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES resources(id) ON DELETE SET NULL;

COMMENT ON COLUMN resources.leader_id IS 'ID do líder responsável por este recurso (opcional)';

-- 2. Adicionar campos de Cliente na tabela projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS client_logo_url TEXT;

COMMENT ON COLUMN projects.client_name IS 'Nome do cliente do projeto';
COMMENT ON COLUMN projects.client_logo_url IS 'URL da logo do cliente (pode ser Supabase Storage URL)';

-- 3. Criar tabela auxiliar de Clientes (para autocomplete e reuso)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE clients IS 'Tabela auxiliar de clientes recorrentes para facilitar seleção';
COMMENT ON COLUMN clients.name IS 'Nome do cliente (único)';
COMMENT ON COLUMN clients.logo_url IS 'URL da logo do cliente';

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at_trigger
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_updated_at();

-- Popular tabela clients com clientes existentes dos projetos
INSERT INTO clients (name, logo_url)
SELECT DISTINCT client_name, client_logo_url
FROM projects
WHERE client_name IS NOT NULL AND client_name != ''
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- INDEXES (opcional - melhorar performance)
-- ============================================

-- Index para buscar recursos por função
CREATE INDEX IF NOT EXISTS idx_resources_role ON resources(role) WHERE role IS NOT NULL;

-- Index para buscar projetos por cliente
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_name) WHERE client_name IS NOT NULL;

-- Index para buscar clientes por nome (autocomplete)
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar se as colunas foram adicionadas
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('resources', 'projects', 'clients')
  AND column_name IN ('role', 'leader_id', 'client_name', 'client_logo_url', 'name', 'logo_url')
ORDER BY table_name, column_name;

-- Contar clientes na tabela auxiliar
SELECT COUNT(*) as total_clients FROM clients;
