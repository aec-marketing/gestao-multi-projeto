/**
 * Barra flutuante que exibe mudanças pendentes no Gantt
 * Similar ao BatchSaveBar da aba Tabela
 */

import React from 'react'
import { GanttPendingChange } from '../hooks/useGanttPendingChanges'
import { formatMinutes } from '@/utils/time.utils'

interface GanttBatchSaveBarProps {
  pendingChanges: GanttPendingChange[]
  onSave: () => void
  onCancel: () => void
  onRecalculatePredecessors: () => void
  isSaving?: boolean
}

export function GanttBatchSaveBar({
  pendingChanges,
  onSave,
  onCancel,
  onRecalculatePredecessors,
  isSaving = false
}: GanttBatchSaveBarProps) {
  if (pendingChanges.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-white rounded-lg shadow-2xl border-2 border-blue-500 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white">
              <span className="text-2xl">📝</span>
              <div>
                <p className="font-bold text-sm">
                  {pendingChanges.length} mudança(s) pendente(s)
                </p>
                <p className="text-xs text-blue-100">
                  Alterações não salvas no Gantt
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Botão Recalcular Predecessores */}
              <button
                onClick={onRecalculatePredecessors}
                disabled={isSaving}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white rounded-md font-medium text-sm transition-colors flex items-center gap-2"
                title="Recalcular tarefas dependentes baseado nas mudanças"
              >
                🔗 Recalcular
              </button>

              {/* Botão Cancelar */}
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-md font-medium text-sm transition-colors"
              >
                Cancelar
              </button>

              {/* Botão Salvar */}
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-md font-medium text-sm transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    Salvar Tudo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Lista de mudanças */}
        <div className="max-h-48 overflow-y-auto bg-gray-50 border-t">
          {pendingChanges.map((change) => (
            <div
              key={change.taskId}
              className="px-4 py-2 border-b last:border-b-0 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">
                    {change.interactionType === 'resize' && '↔️ '}
                    {change.interactionType === 'drag' && '↕️ '}
                    {change.taskName}
                  </p>
                  <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                    {change.changes.start_date && (
                      <p>
                        📅 Início: <span className="line-through text-gray-400">{change.originalValues.start_date}</span>
                        {' → '}
                        <span className="font-medium text-blue-600">{change.changes.start_date}</span>
                      </p>
                    )}
                    {change.changes.end_date && (
                      <p>
                        🏁 Fim: <span className="line-through text-gray-400">{change.originalValues.end_date}</span>
                        {' → '}
                        <span className="font-medium text-blue-600">{change.changes.end_date}</span>
                      </p>
                    )}
                    {change.changes.duration_minutes !== undefined && (
                      <p>
                        ⏱️ Duração:
                        <span className="line-through text-gray-400 ml-1">
                          {formatMinutes(change.originalValues.duration_minutes || 540, 'short')}
                        </span>
                        {' → '}
                        <span className="font-medium text-blue-600">
                          {formatMinutes(change.changes.duration_minutes, 'short')}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
