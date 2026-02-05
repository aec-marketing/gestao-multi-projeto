/**
 * Header do Gantt com título, estatísticas e botões de ação
 */

import React from 'react'
import { useRouter } from 'next/navigation'

interface GanttHeaderProps {
  projectId: string
  taskCount: number
  dayCount: number
  onSyncDates: () => void
  onAuditConflicts: () => void
  onAuditCycles: () => void
  predecessorEditingMode?: boolean  // ONDA 5.7
  onTogglePredecessorMode?: () => void  // ONDA 5.7
}

export function GanttHeader({
  projectId,
  taskCount,
  dayCount,
  onSyncDates,
  onAuditConflicts,
  onAuditCycles,
  predecessorEditingMode = false,
  onTogglePredecessorMode
}: GanttHeaderProps) {
  const router = useRouter()

  return (
    <div className="p-4 border-b bg-gray-50">
      <div className="flex items-center justify-between">
        {/* Título e estatísticas */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cronograma Gantt</h2>
          <p className="text-sm text-gray-600">
            {taskCount} tarefas • {dayCount} dias
          </p>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2">
          {/* Visualização para apresentação */}
          <button
            onClick={() => router.push(`/projeto/${projectId}/apresentacao`)}
            className="px-3 py-1 text-sm rounded bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
            title="Abrir visualização para apresentação e impressão"
          >
            📄 Abrir Visualização
          </button>

          {/* Sincronizar datas */}
          <button
            onClick={onSyncDates}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            title="Sincronizar datas de todas as tarefas pai com suas subtarefas"
          >
            🔄 Sincronizar Datas
          </button>

          {/* Verificar conflitos */}
          <button
            onClick={onAuditConflicts}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="Verificar e corrigir conflitos de predecessores"
          >
            🔄 Verificar Conflitos
          </button>

          {/* Auditar ciclos */}
          <button
            onClick={onAuditCycles}
            className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors flex items-center gap-2"
            title="Verificar ciclos em predecessores"
          >
            🔄 Auditar Ciclos
          </button>

          {/* ONDA 5.7: Modo de edição de predecessores */}
          {onTogglePredecessorMode && (
            <button
              onClick={onTogglePredecessorMode}
              className={`px-3 py-1 text-sm rounded transition-all flex items-center gap-2 ${
                predecessorEditingMode
                  ? 'bg-purple-600 text-white ring-2 ring-purple-300 shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={predecessorEditingMode ? "Desativar modo de edição de predecessores" : "Ativar modo de edição visual de predecessores"}
            >
              {predecessorEditingMode ? '🔗 Modo Ativo' : '🔗 Editar Predecessores'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
