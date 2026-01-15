'use client'

import { useRouter } from 'next/navigation'
import { CalendarEvent } from '@/types/allocation.types'

interface TaskDetailModalProps {
  isOpen: boolean
  onClose: () => void
  tasks: CalendarEvent[]
  projectName: string
  projectCode: string
  resourceName: string
}

export default function TaskDetailModal({
  isOpen,
  onClose,
  tasks,
  projectName,
  projectCode,
  resourceName
}: TaskDetailModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  const handleGoToGantt = (taskId: string) => {
    // Navegar para a página do projeto com a tarefa destacada
    router.push(`/projeto/${tasks[0].projectId}?highlightTask=${taskId}`)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const priorityConfig = {
    alta: {
      label: 'Alta',
      color: 'text-red-700 bg-red-100 border-red-300',
      icon: '🔴'
    },
    media: {
      label: 'Média',
      color: 'text-yellow-700 bg-yellow-100 border-yellow-300',
      icon: '🟡'
    },
    baixa: {
      label: 'Baixa',
      color: 'text-green-700 bg-green-100 border-green-300',
      icon: '🟢'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Cliente (se disponível) */}
              {tasks.length > 0 && tasks[0].clientName && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-600">🏢 {tasks[0].clientName}</span>
                </div>
              )}

              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  {projectCode}
                </span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-sm text-gray-600">{resourceName}</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{projectName}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'} alocada(s)
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="Fechar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body - Lista de Tarefas */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <div
                key={task.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded border ${priorityConfig[task.priority].color}`}
                      >
                        {priorityConfig[task.priority].icon} {priorityConfig[task.priority].label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{task.title}</h3>
                    <p className="text-sm text-gray-600 capitalize">
                      <span className="font-medium">Tipo:</span> {task.taskType}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                  <div>
                    <span className="text-gray-500">Início:</span>
                    <p className="font-medium text-gray-900">{formatDate(task.startDate)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Término:</span>
                    <p className="font-medium text-gray-900">{formatDate(task.endDate)}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleGoToGantt(task.id)}
                  className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <span>Ver no Gantt</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
