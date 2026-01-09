'use client'

import { supabase } from '@/lib/supabase'
import { calculateDurationFromDates } from '@/utils/taskDateSync'

interface TaskUpdate {
  id: string
  start_date: string
  end_date: string
  reason: string
}

interface RecalculateModalProps {
  isOpen: boolean
  updates: TaskUpdate[]
  taskNames: Map<string, string>
  onClose: () => void
  onApply: () => void
}

export default function RecalculateModal({
  isOpen,
  updates,
  taskNames,
  onClose,
  onApply
}: RecalculateModalProps) {
  if (!isOpen) return null

  async function handleApply() {
    try {
      for (const update of updates) {
        // Calcular duração baseada nas novas datas
        const calculatedDuration = calculateDurationFromDates(
          update.start_date,
          update.end_date
        )


        const { error } = await supabase
          .from('tasks')
          .update({
            start_date: update.start_date,
            end_date: update.end_date,
            duration: calculatedDuration  // ✅ Atualizar duration também!
          })
          .eq('id', update.id)

        if (error) throw error
      }

      onApply()
    } catch (error) {
      alert('Erro ao aplicar recalculações: ' + (error as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="bg-blue-600 text-white px-6 py-4">
          <h2 className="text-xl font-bold">🔗 Recalcular Tarefas Dependentes</h2>
          <p className="text-sm text-blue-100 mt-1">
            {updates.length} tarefa(s) precisam ser ajustadas
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 text-xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm text-yellow-800 font-medium">
                  As seguintes tarefas têm predecessores que foram alterados.
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Clique em &quot;Aplicar&quot; para ajustar automaticamente as datas.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {updates.map((update, index) => {
              const taskName = taskNames.get(update.id) || 'Tarefa desconhecida'

              return (
                <div
                  key={update.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        <h3 className="font-semibold text-gray-900">
                          {taskName}
                        </h3>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">
                        {update.reason}
                      </p>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs mb-1">Nova data de início:</p>
                          <p className="font-medium text-green-700">
                            {new Date(update.start_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs mb-1">Nova data de término:</p>
                          <p className="font-medium text-green-700">
                            {new Date(update.end_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ✓ Aplicar Recalculações
          </button>
        </div>
      </div>
    </div>
  )
}
