/**
 * Barra de filtros do Gantt (tipo, pessoa, progresso, zoom)
 */

import React from 'react'
import { Resource } from '@/types/database.types'
import { ZoomLevel } from '../types/gantt.types'

interface GanttFiltersProps {
  // Valores atuais dos filtros
  filterType: string
  filterPerson: string
  filterProgress: string
  zoomLevel: ZoomLevel
  sortOrder: 'structural' | 'chronological'

  // Dados para popular dropdowns
  resources: Resource[]
  filteredCount: number

  // Handlers
  onFilterTypeChange: (value: string) => void
  onFilterPersonChange: (value: string) => void
  onFilterProgressChange: (value: string) => void
  onZoomLevelChange: (level: ZoomLevel) => void
  onSortOrderChange: (order: 'structural' | 'chronological') => void
  onClearFilters: () => void
}

export function GanttFilters({
  filterType,
  filterPerson,
  filterProgress,
  zoomLevel,
  sortOrder,
  resources,
  filteredCount,
  onFilterTypeChange,
  onFilterPersonChange,
  onFilterProgressChange,
  onZoomLevelChange,
  onSortOrderChange,
  onClearFilters
}: GanttFiltersProps) {
  const hasActiveFilters = filterType !== 'all' || filterPerson !== 'all' || filterProgress !== 'all'

  return (
    <div className="bg-white border-b p-4">
      <div className="flex items-center gap-4">
        {/* Filtro por Tipo */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Tipo:</label>
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
          >
            <option value="all">Todos</option>
            <option value="projeto_mecanico">Projeto Mecânico</option>
            <option value="compras_mecanica">Compras Mecânica</option>
            <option value="projeto_eletrico">Projeto Elétrico</option>
            <option value="compras_eletrica">Compras Elétrica</option>
            <option value="fabricacao">Fabricação</option>
            <option value="tratamento_superficial">Tratamento Superficial</option>
            <option value="montagem_mecanica">Montagem Mecânica</option>
            <option value="montagem_eletrica">Montagem Elétrica</option>
            <option value="coleta">Coleta</option>
          </select>
        </div>

        {/* Filtro por Pessoa */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Pessoa:</label>
          <select
            value={filterPerson}
            onChange={(e) => onFilterPersonChange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
          >
            <option value="all">Todas</option>
            {resources.map(resource => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Progresso */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={filterProgress}
            onChange={(e) => onFilterProgressChange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
          >
            <option value="all">Todos</option>
            <option value="not_started">Não iniciado (0%)</option>
            <option value="in_progress">Em andamento (1-99%)</option>
            <option value="completed">Concluído (100%)</option>
          </select>
        </div>

        {/* Toggle de Ordenação */}
        <div className="flex items-center gap-2 border-l pl-4">
          <label className="text-sm font-medium text-gray-700">Ordenar:</label>
          <div className="flex bg-gray-100 rounded-md p-1">
            <button
              onClick={() => onSortOrderChange('structural')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                sortOrder === 'structural'
                  ? 'bg-white shadow text-gray-900 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 Estrutural
            </button>
            <button
              onClick={() => onSortOrderChange('chronological')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                sortOrder === 'chronological'
                  ? 'bg-white shadow text-gray-900 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ⏱️ Cronológica
            </button>
          </div>
        </div>

        {/* Contador e limpar filtros */}
        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {filteredCount} tarefa(s)
          </span>

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
