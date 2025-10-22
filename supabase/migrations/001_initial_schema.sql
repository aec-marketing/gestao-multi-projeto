-- Sistema de Gestão Multi-Projeto
-- Migração inicial do banco de dados

-- 1. Habilitar extensões necessárias (gen_random_uuid já está disponível por padrão)

-- 2. Tipos ENUM
CREATE TYPE project_category AS ENUM (
  'laudo_tecnico',
  'projeto_mecanico',
  'projeto_eletrico',
  'projeto_mecanico_eletrico',
  'projeto_completo',
  'manutencao',
  'readequacao',
  'retrofit'
);

CREATE TYPE project_complexity AS ENUM (
  'simples',
  'padrao',
  'complexo'
);

CREATE TYPE resource_role AS ENUM (
  'gerente',
  'lider',
  'operador'
);

CREATE TYPE task_type AS ENUM (
  'projeto_mecanico',
  'compras_mecanica',
  'projeto_eletrico',
  'compras_eletrica',
  'fabricacao',
  'tratamento_superficial',
  'montagem_mecanica',
  'montagem_eletrica',
  'coleta',
  'subtarefa'
);

CREATE TYPE predecessor_type AS ENUM (
  'fim_inicio',
  'inicio_inicio',
  'fim_fim'
);

CREATE TYPE process_type AS ENUM (
  'serra',
  'fresa',
  'torno',
  'cnc'
);

-- 3. Tabela de recursos (usuários)
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  role resource_role NOT NULL,
  leader_id UUID REFERENCES resources(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de fornecedores
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  show_in_purchases BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de projetos
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category project_category NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,
  leader_id UUID REFERENCES resources(id),
  template_id UUID,
  complexity project_complexity DEFAULT 'padrao',
  buffer_days INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabela de tarefas
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type task_type NOT NULL,
  parent_id UUID REFERENCES tasks(id),
  duration DECIMAL(3,1) DEFAULT 1.0, -- Em dias (0.5 = meio dia)
  start_date DATE,
  end_date DATE,
  is_optional BOOLEAN DEFAULT false,
  is_critical_path BOOLEAN DEFAULT false,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabela de predecessores
CREATE TABLE predecessors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  predecessor_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type predecessor_type DEFAULT 'fim_inicio',
  lag_time INTEGER DEFAULT 0, -- Em dias
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabela de alocações de recursos
CREATE TABLE allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  percentage INTEGER DEFAULT 100 CHECK (percentage > 0 AND percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Tabela de materiais
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit VARCHAR(20) DEFAULT 'UN',
  supplier_id UUID REFERENCES suppliers(id),
  process_type process_type,
  task_id UUID REFERENCES tasks(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Tabela de templates de projeto
CREATE TABLE project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category project_category NOT NULL,
  complexity project_complexity NOT NULL,
  default_tasks JSONB NOT NULL, -- Estrutura das tarefas padrão
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Índices para performance
CREATE INDEX idx_projects_leader ON projects(leader_id);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_active ON projects(is_active);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_dates ON tasks(start_date, end_date);
CREATE INDEX idx_allocations_resource ON allocations(resource_id);
CREATE INDEX idx_allocations_task ON allocations(task_id);
CREATE INDEX idx_allocations_dates ON allocations(start_date, end_date);
CREATE INDEX idx_materials_project ON materials(project_id);
CREATE INDEX idx_resources_leader ON resources(leader_id);

-- 12. Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allocations_updated_at BEFORE UPDATE ON allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. RLS (Row Level Security) - Configurar após auth
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;