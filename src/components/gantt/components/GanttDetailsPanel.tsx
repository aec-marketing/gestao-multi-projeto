/**
 * Painel flutuante de detalhes da tarefa selecionada (ONDA 2 + 3)
 * Exibe informações completas com duration_minutes e work_type
 * ONDA 5.6: Layout otimizado e compacto
 */

import React, { useState } from 'react'
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
  const [isMinimized, setIsMinimized] = useState(false)
  const workTypeLabel = workTypeLabels[task.work_type || 'work']

  // Modo minimizado: apenas header compacto
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 glassmorphism-panel animate-slide-up z-40 rounded-lg shadow-lg max-w-xs">
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{task.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="Expandir"
            >
              ▲
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Modo expandido: layout otimizado
  return (
    <div className="fixed bottom-4 right-4 glassmorphism-panel animate-slide-up z-40 rounded-lg shadow-lg max-w-md">
      <div className="p-4">
        {/* Header compacto */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">{task.name}</h3>
            <div className="text-xs text-gray-500 mt-0.5">
              {task.wbs_code && <span className="font-mono">{task.wbs_code}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="Minimizar"
            >
              ▼
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Informações principais em layout compacto */}
        <div className="space-y-2">
          {/* Linha 1: Datas */}
          <div className="flex gap-2 text-xs">
            <div className="flex-1 bg-white/80 rounded px-2 py-1.5">
              <span className="text-gray-500">Início:</span>
              <span className="ml-1 font-semibold text-gray-900">
                {task.start_date ? formatDateBR(task.start_date) : '-'}
              </span>
            </div>
            <div className="flex-1 bg-white/80 rounded px-2 py-1.5">
              <span className="text-gray-500">Fim:</span>
              <span className="ml-1 font-semibold text-gray-900">
                {task.end_date ? formatDateBR(task.end_date) : '-'}
              </span>
            </div>
          </div>

          {/* Linha 2: Duração e Categoria */}
          <div className="flex gap-2 text-xs">
            <div className="flex-1 bg-white/80 rounded px-2 py-1.5">
              <span className="text-gray-500">Duração:</span>
              <span className="ml-1 font-semibold text-gray-900">
                {formatMinutes(task.duration_minutes, 'short', task.work_type)}
              </span>
            </div>
            <div className="flex-1 bg-white/80 rounded px-2 py-1.5">
              <span className="text-gray-500">Categoria:</span>
              <span className="ml-1 font-semibold text-gray-900">
                {workTypeLabel}
              </span>
            </div>
          </div>

          {/* Linha 3: Progresso e Tipo */}
          <div className="flex gap-2 text-xs">
            <div className="flex-1 bg-white/80 rounded px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Progresso:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      task.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-900 w-8 text-right">
                  {task.progress}%
                </span>
              </div>
            </div>
          </div>

          {/* Linha 4: Tipo de tarefa */}
          <div className="bg-white/80 rounded px-2 py-1.5 text-xs">
            <span className="text-gray-500">Tipo:</span>
            <span className="ml-1 font-semibold text-gray-900">
              {task.type?.replace('_', ' ') || '-'}
            </span>
          </div>

          {/* Margens (apenas se existirem) */}
          {((task.margin_start && task.margin_start > 0) || (task.margin_end && task.margin_end > 0)) && (
            <div className="flex gap-2 text-xs">
              {task.margin_start !== undefined && task.margin_start > 0 && (
                <div className="flex-1 bg-blue-50 rounded px-2 py-1.5">
                  <span className="text-blue-600">Margem Início:</span>
                  <span className="ml-1 font-semibold text-blue-900">
                    {task.margin_start}d
                  </span>
                </div>
              )}
              {task.margin_end !== undefined && task.margin_end > 0 && (
                <div className="flex-1 bg-blue-50 rounded px-2 py-1.5">
                  <span className="text-blue-600">Margem Fim:</span>
                  <span className="ml-1 font-semibold text-blue-900">
                    {task.margin_end}d
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Recursos alocados (compacto) */}
          {allocations.length > 0 && (
            <div className="bg-purple-50 rounded px-2 py-1.5">
              <div className="text-xs text-purple-600 mb-1">Recursos:</div>
              <div className="flex flex-wrap gap-1">
                {allocations.map((alloc) => (
                  <span
                    key={alloc.id}
                    className="inline-flex items-center bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[10px] font-medium"
                  >
                    {alloc.resource.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
