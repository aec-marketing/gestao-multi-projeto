'use client'

import Link from 'next/link'
import MonthNavigator from './MonthNavigator'

interface CalendarHeaderProps {
  currentMonth: Date
  onMonthChange: (newMonth: Date) => void
  selectedResource: string | null
  selectedProject: string | null
  resources: Array<{ id: string; name: string }>
  projects: Array<{ id: string; code: string; name: string }>
  onResourceChange: (resourceId: string | null) => void
  onProjectChange: (projectCode: string | null) => void
  onResetFilters: () => void
  hasActiveFilters: boolean
  onAddEvent: () => void
}

/**
 * Calendar header with navigation and filters
 */
export default function CalendarHeader({
  currentMonth,
  onMonthChange,
  selectedResource,
  selectedProject,
  resources,
  projects,
  onResourceChange,
  onProjectChange,
  onResetFilters,
  hasActiveFilters,
  onAddEvent,
}: CalendarHeaderProps) {
  return (
    <div className="bg-white border-b p-4 space-y-4">
      {/* Top row: Title + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Voltar
          </Link>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              📅 Calendário de Recursos
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Visualize alocações e disponibilidade da equipe
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Add Personal Event Button */}
          <button
            onClick={onAddEvent}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>➕</span>
            <span>Adicionar Evento Pessoal</span>
          </button>

          <MonthNavigator currentMonth={currentMonth} onMonthChange={onMonthChange} />
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3">
        {/* Resource filter */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Filtrar por Recurso
          </label>
          <select
            value={selectedResource || ''}
            onChange={(e) => onResourceChange(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos os recursos</option>
            {resources.map(resource => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </div>

        {/* Project filter */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Filtrar por Projeto
          </label>
          <select
            value={selectedProject || ''}
            onChange={(e) => onProjectChange(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos os projetos</option>
            {projects.map(project => (
              <option key={project.id} value={project.code}>
                {project.code} - {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Reset filters button */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              onClick={onResetFilters}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
              title="Limpar todos os filtros"
            >
              ✕ Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-600 pt-2 border-t">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-50 border border-yellow-300 rounded"></div>
          <span>Ausência</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-50 border border-red-300 rounded"></div>
          <span>Conflito</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-50 border border-blue-300 rounded"></div>
          <span>Alta Carga (3+ tarefas)</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="font-medium">Prioridade:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-red-500 rounded"></div>
            <span>Alta</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-yellow-500 rounded"></div>
            <span>Média</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-green-500 rounded"></div>
            <span>Baixa</span>
          </div>
        </div>
      </div>
    </div>
  )
}
