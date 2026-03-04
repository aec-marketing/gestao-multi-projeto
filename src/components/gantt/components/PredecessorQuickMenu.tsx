/**
 * Menu rápido para predecessor - ONDA 5.7
 * Aparece ao clicar em uma linha de predecessor no Gantt
 */

'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMinutes, parseTimeInput, getTimeInputPlaceholder } from '@/utils/time.utils'
import { dispatchToast } from '@/components/ui/ToastProvider'
import { recalculateTasksInCascade } from '@/utils/predecessorCalculations'

interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string
  lag_time: number
  lag_minutes?: number
}

interface Task {
  id: string
  name: string
}

interface PredecessorQuickMenuProps {
  predecessor: Predecessor
  fromTask: Task
  toTask: Task
  onClose: () => void
  onUpdate: () => void  // Callback para refresh após edição/exclusão
  allTasks: Task[]  // Todas as tarefas para recálculo
  allPredecessors: Predecessor[]  // Todos os predecessores para recálculo
}

// Mapas de conversão
const TYPE_TO_DISPLAY: Record<string, string> = {
  'fim_inicio': 'FS (Fim → Início)',
  'inicio_inicio': 'SS (Início → Início)',
  'fim_fim': 'FF (Fim → Fim)'
}

const DISPLAY_TO_TYPE: Record<string, string> = {
  'FS': 'fim_inicio',
  'SS': 'inicio_inicio',
  'FF': 'fim_fim'
}

export function PredecessorQuickMenu({
  predecessor,
  fromTask,
  toTask,
  onClose,
  onUpdate,
  allTasks,
  allPredecessors
}: PredecessorQuickMenuProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [lagInput, setLagInput] = useState<string>(
    formatMinutes(predecessor.lag_minutes || 0, 'short')
  )
  const [relationType, setRelationType] = useState<string>(
    predecessor.type === 'fim_inicio' ? 'FS' :
    predecessor.type === 'inicio_inicio' ? 'SS' :
    predecessor.type === 'fim_fim' ? 'FF' : 'FS'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    try {
      // Parse do input de lag
      const lagMinutes = parseTimeInput(lagInput)
      if (lagMinutes === null) {
        setError('Formato inválido. Use: "2h", "30m", "1.5d" ou "2d 3h"')
        setLoading(false)
        return
      }

      // Validar que lag não pode ser negativo
      if (lagMinutes < 0) {
        setError('Lag não pode ser negativo')
        setLoading(false)
        return
      }

      const newType = DISPLAY_TO_TYPE[relationType]

      // Atualizar predecessor no banco
      const { error: updateError } = await supabase
        .from('predecessors')
        .update({
          type: newType,
          lag_minutes: lagMinutes
        })
        .eq('id', predecessor.id)

      if (updateError) throw updateError

      // Criar predecessor atualizado para recálculo
      const updatedPredecessor = {
        ...predecessor,
        type: newType,
        lag_minutes: lagMinutes
      }

      // Atualizar lista de predecessores
      const updatedPredecessors = allPredecessors.map(p =>
        p.id === predecessor.id ? updatedPredecessor : p
      )

      // Recalcular datas em cascata a partir da tarefa predecessora
      const updates = recalculateTasksInCascade(
        predecessor.predecessor_id,
        allTasks,
        updatedPredecessors
      )

      // Aplicar atualizações de datas no banco
      if (updates.length > 0) {
        console.log(`🔄 Recalculando ${updates.length} tarefas após editar predecessor...`)

        for (const update of updates) {
          const { error: dateError } = await supabase
            .from('tasks')
            .update({
              start_date: update.start_date,
              end_date: update.end_date
            })
            .eq('id', update.id)

          if (dateError) {
            console.error('Erro ao atualizar tarefa:', dateError)
          }
        }
      }

      dispatchToast('Predecessor atualizado! Datas recalculadas.', 'success')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Erro ao atualizar:', error)
      setError('Erro ao atualizar predecessor')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir a dependência?\n${fromTask.name} → ${toTask.name}`)) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('predecessors')
        .delete()
        .eq('id', predecessor.id)

      if (error) throw error

      dispatchToast('Predecessor excluído!', 'success')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      dispatchToast('Erro ao excluir predecessor', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-30 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b">
          <h3 className="text-lg font-bold text-gray-800">
            {isEditing ? '✏️ Editar Predecessor' : '🔗 Dependência'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Conexão */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">De:</div>
          <div className="font-semibold text-gray-800 mb-2">{fromTask.name}</div>
          <div className="text-center text-blue-600 mb-2">↓</div>
          <div className="text-sm text-gray-600 mb-1">Para:</div>
          <div className="font-semibold text-gray-800">{toTask.name}</div>
        </div>

        {isEditing ? (
          <>
            {/* Modo de Edição */}
            <div className="space-y-4">
              {/* Tipo de Relação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Relação:
                </label>
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white"
                >
                  <option value="FS">FS - Fim → Início (Padrão)</option>
                  <option value="SS">SS - Início → Início</option>
                  <option value="FF">FF - Fim → Fim</option>
                </select>
              </div>

              {/* Lag */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Atraso (Lag):
                </label>
                <input
                  type="text"
                  value={lagInput}
                  onChange={(e) => setLagInput(e.target.value)}
                  placeholder={getTimeInputPlaceholder()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Tempo de espera entre as tarefas. Ex: "2h", "30m", "1.5d", "2d 3h"
                </div>
                {error && (
                  <div className="text-xs text-red-600 mt-1">
                    {error}
                  </div>
                )}
              </div>

              {/* Botões de Edição */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
                >
                  {loading ? 'Salvando...' : '💾 Salvar'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Modo de Visualização */}
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Tipo:</span>
                <span className="font-medium text-gray-800">
                  {TYPE_TO_DISPLAY[predecessor.type] || predecessor.type}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Atraso (Lag):</span>
                <span className="font-medium text-gray-800">
                  {predecessor.lag_minutes > 0 ? formatMinutes(predecessor.lag_minutes, 'auto') : 'Nenhum'}
                </span>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                ✏️ Editar
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-300 font-medium"
              >
                {loading ? 'Excluindo...' : '🗑️ Excluir'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
