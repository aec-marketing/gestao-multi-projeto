'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Task } from '@/types/database.types'
import EditPredecessorModal from '@/components/modals/EditPredecessorModal'
import { recalculateTasksInCascade } from '@/utils/predecessorCalculations'

// ============ HELPER FUNCTIONS ============

/**
 * Converte tipo da UI (FS/SS/FF) para o formato do banco de dados
 */
function convertTypeToDB(displayType: string): string {
  const typeMap: Record<string, string> = {
    'FS': 'fim_inicio',
    'SS': 'inicio_inicio',
    'FF': 'fim_fim'
  }
  return typeMap[displayType] || 'fim_inicio'
}

/**
 * Converte tipo do banco de dados para o formato da UI (FS/SS/FF)
 */
function convertTypeFromDB(dbType: string): string {
  const displayMap: Record<string, string> = {
    'fim_inicio': 'FS',
    'inicio_inicio': 'SS',
    'fim_fim': 'FF'
  }
  return displayMap[dbType] || 'FS'
}

interface AddPredecessorModalProps {
  isOpen: boolean
  task: Task | null
  allTasks: Task[]
  existingPredecessors: Array<{ task_id: string; predecessor_id: string }>
  allPredecessors: any[]
  onClose: () => void
  onSuccess: () => void
  onRecalculate?: (updates: any[]) => void
}

export default function AddPredecessorModal({
  isOpen,
  task,
  allTasks,
  existingPredecessors,
  allPredecessors,
  onClose,
  onSuccess,
  onRecalculate
}: AddPredecessorModalProps) {
  const [selectedPredecessor, setSelectedPredecessor] = useState<string>('')
  const [relationType, setRelationType] = useState<'FS' | 'SS' | 'FF'>('FS')
  const [lagDays, setLagDays] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

// Adicionar junto com os outros states
const [showEditModal, setShowEditModal] = useState(false)
const [editingPredecessor, setEditingPredecessor] = useState<any>(null)

  if (!isOpen || !task) return null

  // ============ VALIDAÇÕES ============

  function validateInputs(): string | null {
    if (!task) return 'Tarefa não encontrada'

    // Validação 1: Predecessor selecionado?
    if (!selectedPredecessor) {
      return 'Selecione uma tarefa predecessor'
    }

    // Validação 2: Não é self-reference?
    if (selectedPredecessor === task.id) {
      return 'Uma tarefa não pode depender de si mesma'
    }

    // Validação 3: Não duplica?
    if (existingPredecessors.some(p =>
      p.task_id === task.id && p.predecessor_id === selectedPredecessor
    )) {
      return 'Essa dependência já existe'
    }

    return null
  }

  function detectCycle(fromTaskId: string, toTaskId: string, allPreds: Array<{ task_id: string; predecessor_id: string }>): boolean {
    // BFS para detectar ciclo
    const visited = new Set<string>()
    const queue: string[] = [toTaskId]

    while (queue.length > 0) {
      const current = queue.shift()!

      if (current === fromTaskId) {
        return true // Encontrou ciclo
      }

      if (visited.has(current)) continue
      visited.add(current)

      // Encontrar predecessores do current
      const preds = allPreds
        .filter(p => p.task_id === current)
        .map(p => p.predecessor_id)

      queue.push(...preds)
    }

    return false
  }

  // ============ SUBMIT ============

  async function handleAddPredecessor() {
    if (!task) return

    setError(null)

    // Validar inputs
    const validationError = validateInputs()
    if (validationError) {
      setError(validationError)
      return
    }

    // Validar ciclo
    if (detectCycle(task.id, selectedPredecessor, existingPredecessors)) {
      setError('Isso criaria um ciclo de dependências (A→B→C→A)')
      return
    }

    setLoading(true)

    try {
      const { error: insertError } = await supabase
        .from('predecessors')
        .insert({
          task_id: task.id,
          predecessor_id: selectedPredecessor,
          type: convertTypeToDB(relationType), // ✅ converte FS → fim_inicio
          lag_time: lagDays  // ✅ nome correto da coluna
        })

      if (insertError) throw insertError

      console.log('🆕 Novo predecessor adicionado, recalculando tarefas dependentes...')

      // Criar o novo predecessor para cálculo
      const newPredecessor = {
        id: 'temp', // ID temporário
        task_id: task.id,
        predecessor_id: selectedPredecessor,
        type: convertTypeToDB(relationType),
        lag_time: lagDays
      }

      // Adicionar ao array de predecessores
      const updatedPredecessors = [...allPredecessors, newPredecessor]

      // Recalcular a partir da tarefa predecessora
      const updates = recalculateTasksInCascade(
        selectedPredecessor, // A tarefa predecessora que foi vinculada
        allTasks,
        updatedPredecessors
      )

      if (updates.length > 0 && onRecalculate) {
        // Enviar updates para o componente pai mostrar modal
        onRecalculate(updates)

        // Reset form e fecha este modal
        setSelectedPredecessor('')
        setRelationType('FS')
        setLagDays(0)
        onClose()
      } else {
        // Sem updates, fecha normalmente
        setSelectedPredecessor('')
        setRelationType('FS')
        setLagDays(0)
        onSuccess()
        onClose()
      }
    } catch (err) {
      console.error('Erro ao adicionar predecessor:', err)
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ============ GET AVAILABLE PREDECESSORS ============
  const availablePredecessors = !task ? [] : allTasks.filter(t => {
    // Não mostrar a própria tarefa
    if (t.id === task.id) return false

    // Não mostrar se já existe essa dependência
    if (existingPredecessors.some(p =>
      p.task_id === task.id && p.predecessor_id === t.id
    )) return false

    return true
  })

  // ============ RENDER ============

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              ➕ Adicionar Predecessor
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Tarefa: {task.sort_order} {task.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Predecessor Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Depende de (Predecessor):
            </label>
            <select
              value={selectedPredecessor}
              onChange={(e) => {
                setSelectedPredecessor(e.target.value)
                setError(null)
              }}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">🔍 Escolha uma tarefa...</option>
              {availablePredecessors.length === 0 ? (
                <option disabled>Nenhuma tarefa disponível</option>
              ) : (
                availablePredecessors.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.sort_order} {t.name}
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              💡 A tarefa selecionada deve ser concluída antes desta
            </p>
          </div>

          {/* Relation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Relação:
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="FS"
                  checked={relationType === 'FS'}
                  onChange={(e) => setRelationType(e.target.value as 'FS' | 'SS' | 'FF')}
                  disabled={loading}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-900">
                  <span className="font-mono bg-blue-100 px-2 py-1 rounded text-blue-700">→ FS</span>
                  {' '}Fim-Início (padrão)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="SS"
                  checked={relationType === 'SS'}
                  onChange={(e) => setRelationType(e.target.value as 'FS' | 'SS' | 'FF')}
                  disabled={loading}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-900">
                  <span className="font-mono bg-green-100 px-2 py-1 rounded text-green-700">⇒ SS</span>
                  {' '}Início-Início
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="FF"
                  checked={relationType === 'FF'}
                  onChange={(e) => setRelationType(e.target.value as 'FS' | 'SS' | 'FF')}
                  disabled={loading}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-900">
                  <span className="font-mono bg-orange-100 px-2 py-1 rounded text-orange-700">← FF</span>
                  {' '}Fim-Fim
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 FS: predecessor termina, depois essa começa  
              SS: começa junto, com lag  
              FF: terminam no mesmo dia
            </p>
          </div>

          {/* Lag Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lag Time (dias):
            </label>
            <input
              type="number"
              step="0.5"
              value={lagDays}
              onChange={(e) => setLagDays(parseFloat(e.target.value) || 0)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 0 = sem lag, 1 = 1 dia, 0.5 = meio dia, -1 = sobreposição
            </p>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <strong>ℹ️ O que vai acontecer:</strong>
            <br />
            Se a tarefa predecessor mover {lagDays !== 0 ? `(+${lagDays} dias)` : '(sem delay)'}, essa também vai se mover automaticamente.
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAddPredecessor}
            disabled={loading || !selectedPredecessor}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '⏳ Salvando...' : '✅ Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}