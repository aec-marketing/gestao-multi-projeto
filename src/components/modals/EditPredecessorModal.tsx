'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Task } from '@/types/database.types'
import { recalculateTasksInCascade } from '@/utils/predecessorCalculations'

interface EditPredecessorModalProps {
  isOpen: boolean
  predecessor: {
    id: string
    task_id: string
    predecessor_id: string
    type: string
    lag_time: number
  } | null
  allTasks: Task[]
  allPredecessors: any[]
  onClose: () => void
  onSuccess: () => void
  onRecalculate?: (updates: any[]) => void
}

// Conversão DB ↔ Display
const typeMap = {
  'fim_inicio': 'FS',
  'inicio_inicio': 'SS',
  'fim_fim': 'FF'
}

const typeMapReverse = {
  'FS': 'fim_inicio',
  'SS': 'inicio_inicio',
  'FF': 'fim_fim'
}

export default function EditPredecessorModal({
  isOpen,
  predecessor,
  allTasks,
  allPredecessors,
  onClose,
  onSuccess,
  onRecalculate
}: EditPredecessorModalProps) {
  const [selectedType, setSelectedType] = useState<'FS' | 'SS' | 'FF'>('FS')
  const [lagDays, setLagDays] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Preencher campos ao abrir modal
  useEffect(() => {
    if (predecessor) {
      const displayType = (typeMap[predecessor.type as keyof typeof typeMap] || 'FS') as 'FS' | 'SS' | 'FF'
      setSelectedType(displayType)
      setLagDays(predecessor.lag_time || 0)
    }
  }, [predecessor])

  if (!isOpen || !predecessor) return null

  const task = allTasks.find(t => t.id === predecessor.task_id)
  const predTask = allTasks.find(t => t.id === predecessor.predecessor_id)

  async function handleSave() {
    if (!predecessor) return

    setIsSubmitting(true)

    const { error } = await supabase
      .from('predecessors')
      .update({
        type: typeMapReverse[selectedType],
        lag_time: lagDays
      })
      .eq('id', predecessor.id)

    setIsSubmitting(false)

    if (error) {
      alert('Erro ao salvar alterações')
      return
    }

    // Recalcular tarefas dependentes após alterar o predecessor

    // Atualizar o predecessor no array para cálculo correto
    const updatedPredecessors = allPredecessors.map(p =>
      p.id === predecessor.id
        ? { ...p, type: typeMapReverse[selectedType], lag_time: lagDays }
        : p
    )

    // Recalcular a partir da tarefa predecessora (que foi alterada)
    const updates = recalculateTasksInCascade(
      predecessor.predecessor_id, // A tarefa predecessora que foi modificada
      allTasks,
      updatedPredecessors
    )

    if (updates.length > 0 && onRecalculate) {
      // Enviar updates para o componente pai mostrar modal
      onRecalculate(updates)
      onClose()
    } else {
      // Sem updates, fecha normalmente
      onSuccess()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-xl font-bold text-gray-900 mb-4">✏️ Editar Predecessor</h2>

        {/* Info da dependência */}
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-gray-700">
            <strong className="text-gray-900">{task?.name}</strong> depende de
          </p>
          <p className="text-sm text-blue-700 font-medium">
            → {predTask?.name}
          </p>
        </div>

        {/* Tipo de relação */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Relação
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as 'FS' | 'SS' | 'FF')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="FS">Fim-Início (FS)</option>
            <option value="SS">Início-Início (SS)</option>
            <option value="FF">Fim-Fim (FF)</option>
          </select>
        </div>

        {/* Lag Time */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Lag Time (dias)
          </label>
          <input
            type="number"
            step="0.5"
            value={lagDays}
            onChange={(e) => setLagDays(parseFloat(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use valores negativos para antecipação
          </p>
        </div>

        {/* Botões */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Salvando...' : '✅ Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}