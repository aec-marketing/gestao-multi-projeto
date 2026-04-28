'use client'

import { useState, useMemo } from 'react'
import type { Task, Resource } from '@/types/database.types'
import type { Allocation } from '@/types/allocation.types'
import { exportTasksToExcel } from '@/utils/exportToExcel'

interface ExportModalProps {
  projectName: string
  tasks: Task[]
  allocations: Allocation[]
  resources: Resource[]
  onClose: () => void
}

const TASK_TYPE_LABELS: Record<string, string> = {
  projeto_mecanico: 'Projeto Mecânico',
  compras_mecanica: 'Compras Mecânica',
  projeto_eletrico: 'Projeto Elétrico',
  compras_eletrica: 'Compras Elétrica',
  fabricacao: 'Fabricação',
  tratamento_superficial: 'Tratamento Superficial',
  montagem_mecanica: 'Montagem Mecânica',
  montagem_eletrica: 'Montagem Elétrica',
  coleta: 'Coleta',
  subtarefa: 'Subtarefa',
  lista_compras: 'Lista de Compras',
  grupo_compras: 'Grupo de Compras',
}

export function ExportModal({ projectName, tasks, allocations, resources, onClose }: ExportModalProps) {
  const rootTasks = useMemo(
    () => tasks
      .filter(t => !t.parent_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [tasks]
  )

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(rootTasks.map(t => t.id))
  )

  const allSelected = selected.size === rootTasks.length
  const noneSelected = selected.size === 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rootTasks.map(t => t.id)))
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function countSubtasks(taskId: string): number {
    const direct = tasks.filter(t => t.parent_id === taskId)
    return direct.length + direct.reduce((acc, t) => acc + countSubtasks(t.id), 0)
  }

  function handleExport() {
    exportTasksToExcel(projectName, Array.from(selected), tasks, allocations, resources)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Exportar para Excel</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Selecione os grupos que deseja exportar
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Selecionar todos */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = !allSelected && !noneSelected }}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              Selecionar todos ({rootTasks.length} grupos)
            </span>
          </label>
        </div>

        {/* Lista de tarefas */}
        <div className="overflow-y-auto flex-1 px-2 py-2">
          {rootTasks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Nenhuma tarefa encontrada neste projeto.
            </p>
          ) : (
            rootTasks.map(task => {
              const subtaskCount = countSubtasks(task.id)
              const isChecked = selected.has(task.id)

              return (
                <label
                  key={task.id}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer
                    transition-colors select-none
                    ${isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(task.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 accent-blue-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {task.wbs_code && (
                        <span className="text-xs font-mono text-gray-400 flex-shrink-0">
                          {task.wbs_code}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {task.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {TASK_TYPE_LABELS[task.type] ?? task.type}
                      </span>
                      {subtaskCount > 0 && (
                        <span className="text-xs text-gray-400">
                          • {subtaskCount} subtarefa{subtaskCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500">
            {selected.size} de {rootTasks.length} grupo{rootTasks.length !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleExport}
              disabled={noneSelected}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              📥 Exportar Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
