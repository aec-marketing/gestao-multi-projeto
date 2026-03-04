-- Migration 006: Adicionar 'lista_compras' ao enum task_type
-- Necessário para o recurso de Lista de Compras

ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'lista_compras';
