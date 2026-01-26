/**
 * Painel flutuante de detalhes da tarefa selecionada (ONDA 2 + 3)
 * Exibe informações completas com duration_minutes e work_type
 */

import React from 'react'
import { Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { formatDateBR } from '@/utils/date.utils'
import { formatMinutes } from '@/utils/time.utils'
import { workTypeLabels } from '../utils/ganttFormatters'

interface GanttDetailsPanelProps {
  task: Task
  allocations: Array<Allocation & { resource: Resource }>
  onClose: () => void
}

export function GanttDetailsPanel({
  task,
  allocations,
  onClose
}: GanttDetailsPanelProps) {
  const workTypeLabel = workTypeLabels[task.work_type || 'work']

  return (
    <div className="fixed bottom-0 left-0 right-0 glassmorphism-panel animate-slide-up z-50 max-h-80 overflow-y-auto">
      <div className="p-6">
        {/* Header com botão fechar */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{task.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
            title="Fechar painel"
          >
            ✕
          </button>
        </div>

        {/* Grade de informações */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Duração (ONDA 2) */}
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Duração</div>
            <div className="text-sm font-semibold text-gray-900">
              {formatMinutes(task.duration_minutes, 'long')}
            </div>
          </div>

          {/* Tipo de trabalho (ONDA 3) */}
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Categoria</div>
            <div className="text-sm font-semibold text-gray-900">
              {workTypeLabel}
            </div>
          </div>

          {/* Data de início */}
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Data Início</div>
            <div className="text-sm font-semibold text-gray-900">
              {task.start_date ? formatDateBR(task.start_date) : '-'}
            </div>
          </div>

          {/* Data de fim */}
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Data Fim</div>
            <div className="text-sm font-semibold text-gray-900">
              {task.end_date ? formatDateBR(task.end_date) : '-'}
            </div>
          </div>

          {/* Progresso */}
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Progresso</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    task.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 w-10 text-right">
                {task.progress}%
              </span>
            </div>
          </div>

          {/* Tipo */}
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Tipo</div>
            <div className="text-sm font-semibold text-gray-900">
              {task.type?.replace('_', ' ') || '-'}
            </div>
          </div>

          {/* Margem início */}
          {task.margin_start !== undefined && task.margin_start > 0 && (
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">Margem Início</div>
              <div className="text-sm font-semibold text-gray-900">
                {task.margin_start} dias
              </div>
            </div>
          )}

          {/* Margem fim */}
          {task.margin_end !== undefined && task.margin_end > 0 && (
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">Margem Fim</div>
              <div className="text-sm font-semibold text-gray-900">
                {task.margin_end} dias
              </div>
            </div>
          )}
        </div>

        {/* Alocações */}
        {allocations.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Recursos Alocados</h4>
            <div className="flex flex-wrap gap-2">
              {allocations.map((alloc) => (
                <div
                  key={alloc.id}
                  className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium"
                >
                  👤 {alloc.resource.name}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
