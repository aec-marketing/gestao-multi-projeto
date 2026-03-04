'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Task } from '@/types/database.types'
import { dispatchToast } from '@/components/ui/ToastProvider'

interface SubtaskManagerProps {
  parentTask: Task
  onClose: () => void
  onSuccess: () => void
}

export default function SubtaskManager({ parentTask, onClose, onSuccess }: SubtaskManagerProps) {
  const [subtaskName, setSubtaskName] = useState('')
  const [subtaskDuration, setSubtaskDuration] = useState('1')
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreateSubtask() {
    if (!subtaskName.trim()) {
      dispatchToast('Digite um nome para a subtarefa', 'info')
      return
    }

    setIsCreating(true)
    try {
      // Buscar todas as tarefas do projeto para calcular o próximo sort_order
      const { data: allProjectTasks } = await supabase
        .from('tasks')
        .select('sort_order')
        .eq('project_id', parentTask.project_id)
        .order('sort_order', { ascending: false })
        .limit(1)

      // Próximo sort_order é sempre o maior + 1 (garante inteiro)
      const nextSortOrder = allProjectTasks && allProjectTasks.length > 0
        ? allProjectTasks[0].sort_order + 1
        : 1

      // Calcular end_date baseado na duração e start_date do pai
      let subtaskEndDate = null
      if (parentTask.start_date) {
        const startDate = new Date(parentTask.start_date)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + parseFloat(subtaskDuration) - 1)
        subtaskEndDate = endDate.toISOString().split('T')[0]
      }

      // Criar a subtarefa
      const { data: newSubtask, error: insertError } = await supabase
        .from('tasks')
        .insert({
          project_id: parentTask.project_id,
          name: subtaskName.trim(),
          type: 'subtarefa',
          parent_id: parentTask.id,
          duration: parseFloat(subtaskDuration),
          start_date: parentTask.start_date, // Herda start_date do pai
          end_date: subtaskEndDate, // Calcula end_date baseado na duração
          progress: 0,
          sort_order: nextSortOrder,
          is_optional: false,
          is_critical_path: false
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Verificar se a duração da subtarefa é maior que a do pai
      // Buscar todas as subtarefas do pai para calcular a maior duração
      const { data: siblings } = await supabase
        .from('tasks')
        .select('duration')
        .eq('parent_id', parentTask.id)

      const allDurations = [...(siblings || []).map(s => s.duration || 0), parseFloat(subtaskDuration)]
      const maxSubtaskDuration = Math.max(...allDurations)

      if (maxSubtaskDuration > (parentTask.duration || 0)) {
        // Atualizar end_date da tarefa pai (duração é calculada automaticamente)
        if (parentTask.start_date) {
          const newParentEndDate = new Date(parentTask.start_date)
          newParentEndDate.setDate(newParentEndDate.getDate() + maxSubtaskDuration - 1)

          await supabase
            .from('tasks')
            .update({
              end_date: newParentEndDate.toISOString().split('T')[0]
            })
            .eq('id', parentTask.id)
        }
        // Se não tem start_date, não precisa atualizar nada (duração é computed)
      }

      // Buscar alocações de líderes/gerentes da tarefa pai
      const { data: parentAllocations } = await supabase
        .from('allocations')
        .select(`
          *,
          resource:resources(*)
        `)
        .eq('task_id', parentTask.id)

      // Filtrar apenas líderes e gerentes
      const leaderAllocations = parentAllocations?.filter(
        a => a.resource && (a.resource.hierarchy === 'lider' || a.resource.hierarchy === 'gerente')
      ) || []

      // Copiar alocações de líderes para a subtarefa
      if (leaderAllocations.length > 0) {
        const allocationsToInsert = leaderAllocations.map(allocation => ({
          resource_id: allocation.resource_id,
          task_id: newSubtask.id,
          priority: allocation.priority,
          start_date: allocation.start_date,
          end_date: allocation.end_date
        }))

        const { error: allocError } = await supabase
          .from('allocations')
          .insert(allocationsToInsert)

        if (allocError) {
          // Não falhar a criação da subtarefa por causa disso
        }
      }

      setSubtaskName('')
      setSubtaskDuration('1')
      onSuccess()
    } catch (error) {
      dispatchToast('Erro ao criar subtarefa', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              ➕ Adicionar Subtarefa
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Tarefa pai: {parentTask.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome da Subtarefa
            </label>
            <input
              type="text"
              value={subtaskName}
              onChange={(e) => setSubtaskName(e.target.value)}
              placeholder="Ex: Revisar documentação técnica"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateSubtask()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duração (dias)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={subtaskDuration}
              onChange={(e) => setSubtaskDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Use 0.5 para meio dia, 1 para um dia completo
            </p>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            ℹ️ A subtarefa será criada como parte de &quot;{parentTask.name}&quot;
            <div className="mt-2 text-xs">
              💡 <strong>Líderes/Gerentes alocados na tarefa pai serão automaticamente copiados para esta subtarefa.</strong> Você poderá adicionar operadores depois.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateSubtask}
            disabled={isCreating || !subtaskName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Criando...' : '✓ Criar Subtarefa'}
          </button>
        </div>
      </div>
    </div>
  )
}