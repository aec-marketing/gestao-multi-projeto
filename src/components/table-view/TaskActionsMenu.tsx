import React from 'react'

interface TaskActionsMenuProps {
  taskId: string
  taskName: string
  hasSubtasks: boolean
  onAddSubtask: (taskId: string) => void
  onDelete: (taskId: string, taskName: string, hasSubtasks: boolean) => void
}

/**
 * Menu de ações para cada tarefa (adicionar subtarefa, deletar)
 */
export const TaskActionsMenu = React.memo(function TaskActionsMenu({
  taskId,
  taskName,
  hasSubtasks,
  onAddSubtask,
  onDelete
}: TaskActionsMenuProps) {
  return (
    <div className="flex gap-2 justify-center">
      <button
        onClick={() => onAddSubtask(taskId)}
        className="text-green-600 hover:text-green-700 transition-colors p-1"
        title="Adicionar subtarefa"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
      <button
        onClick={() => onDelete(taskId, taskName, hasSubtasks)}
        className="text-red-600 hover:text-red-700 transition-colors p-1"
        title="Excluir tarefa"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
})
