-- Script para verificar o estado atual dos clientes no banco

-- 1. Verificar se a tabela clients existe e tem dados
SELECT 'Tabela clients:' as info;
SELECT id, name, logo_url FROM clients LIMIT 5;

-- 2. Verificar quantos projetos têm client_name preenchido
SELECT 'Projetos com cliente:' as info;
SELECT
  code,
  name,
  client_name,
  CASE WHEN client_logo_url IS NOT NULL THEN 'Sim' ELSE 'Não' END as tem_logo
FROM projects
WHERE client_name IS NOT NULL;

-- 3. Verificar quantos projetos NÃO têm cliente
SELECT 'Projetos SEM cliente:' as info;
SELECT COUNT(*) as total FROM projects WHERE client_name IS NULL;

-- 4. Verificar as colunas da tabela projects
SELECT 'Colunas da tabela projects:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name IN ('client_name', 'client_logo_url');
