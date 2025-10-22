-- Dados iniciais para o Sistema de Gestão Multi-Projeto

-- 1. Inserir fornecedores
INSERT INTO suppliers (name, show_in_purchases) VALUES
('Alcam', false),
('A&C', false),
('Fornecedor Geral', true),
('WEG', true),
('Schneider Electric', true),
('Metaltec', true);

-- 2. Inserir recursos (hierarquia organizacional)
INSERT INTO resources (id, name, email, role, leader_id) VALUES
-- Gerente
('550e8400-e29b-41d4-a716-446655440000', 'Gabriel', 'gabriel@empresa.com', 'gerente', null),

-- Líderes
('550e8400-e29b-41d4-a716-446655440001', 'Vitor', 'vitor@empresa.com', 'lider', '550e8400-e29b-41d4-a716-446655440000'),
('550e8400-e29b-41d4-a716-446655440002', 'Lucas', 'lucas@empresa.com', 'lider', '550e8400-e29b-41d4-a716-446655440000'),
('550e8400-e29b-41d4-a716-446655440003', 'Márcio', 'marcio@empresa.com', 'lider', '550e8400-e29b-41d4-a716-446655440000'),

-- Operadores da equipe do Vitor
('550e8400-e29b-41d4-a716-446655440004', 'Ruan', 'ruan@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440005', 'Levi', 'levi@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440006', 'Vanderlei', 'vanderlei@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440007', 'Rodrigo', 'rodrigo@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440008', 'Miguel', 'miguel@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440009', 'Caique', 'caique@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440001'),

-- Operadores da equipe do Lucas
('550e8400-e29b-41d4-a716-446655440010', 'João', 'joao@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440011', 'Eduardo', 'eduardo@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440012', 'Willian', 'willian@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440013', 'Natan', 'natan@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440014', 'Pedro', 'pedro@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440002'),

-- Operadores da equipe do Márcio
('550e8400-e29b-41d4-a716-446655440015', 'Matheus', 'matheus@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440003'),
('550e8400-e29b-41d4-a716-446655440016', 'Clayton', 'clayton@empresa.com', 'operador', '550e8400-e29b-41d4-a716-446655440003');

-- 3. Inserir templates de projeto
INSERT INTO project_templates (name, category, complexity, default_tasks) VALUES
('Template Projeto Mecânico Simples', 'projeto_mecanico', 'simples', '[
  {"name": "Projeto Mecânico", "type": "projeto_mecanico", "duration": 3},
  {"name": "Compras Lista Mecânica", "type": "compras_mecanica", "duration": 2},
  {"name": "Fabricação", "type": "fabricacao", "duration": 5},
  {"name": "Montagem Mecânica", "type": "montagem_mecanica", "duration": 2},
  {"name": "Coleta", "type": "coleta", "duration": 1}
]'),

('Template Projeto Completo', 'projeto_completo', 'complexo', '[
  {"name": "Projeto Mecânico", "type": "projeto_mecanico", "duration": 5},
  {"name": "Compras Lista Mecânica", "type": "compras_mecanica", "duration": 3},
  {"name": "Projeto Elétrico", "type": "projeto_eletrico", "duration": 4},
  {"name": "Compras Lista Elétrica", "type": "compras_eletrica", "duration": 2},
  {"name": "Fabricação", "type": "fabricacao", "duration": 8},
  {"name": "Tratamento Superficial", "type": "tratamento_superficial", "duration": 3},
  {"name": "Montagem Mecânica", "type": "montagem_mecanica", "duration": 4},
  {"name": "Montagem Elétrica", "type": "montagem_eletrica", "duration": 3},
  {"name": "Coleta", "type": "coleta", "duration": 1}
]');

-- 4. Inserir projeto exemplo
INSERT INTO projects (code, name, category, vendor_name, leader_id, complexity, buffer_days, start_date) VALUES
('PRJ-001', 'Automação Linha de Produção A', 'projeto_completo', 'João Silva', '550e8400-e29b-41d4-a716-446655440001', 'complexo', 2, CURRENT_DATE);

-- 5. Inserir tarefas do projeto exemplo
INSERT INTO tasks (project_id, name, type, duration, sort_order) 
SELECT 
  p.id,
  t.task_name,
  t.task_type::task_type,
  t.duration,
  t.sort_order
FROM projects p,
(VALUES 
  ('Projeto Mecânico', 'projeto_mecanico', 5.0, 1),
  ('Compras Lista Mecânica', 'compras_mecanica', 3.0, 2),
  ('Projeto Elétrico', 'projeto_eletrico', 4.0, 3),
  ('Compras Lista Elétrica', 'compras_eletrica', 2.0, 4),
  ('Fabricação', 'fabricacao', 8.0, 5),
  ('Tratamento Superficial', 'tratamento_superficial', 3.0, 6),
  ('Montagem Mecânica', 'montagem_mecanica', 4.0, 7),
  ('Montagem Elétrica', 'montagem_eletrica', 3.0, 8),
  ('Coleta', 'coleta', 1.0, 9)
) AS t(task_name, task_type, duration, sort_order)
WHERE p.code = 'PRJ-001';
