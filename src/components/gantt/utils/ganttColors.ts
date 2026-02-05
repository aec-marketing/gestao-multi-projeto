/**
 * Get the appropriate color class for a task bar based on type and state
 */
export function getTaskColor(
  type: string,
  isSubtask: boolean,
  isDelayed: boolean = false,
  taskId?: string,
  tasksInCycle?: Set<string>,
  workType?: 'work' | 'wait' | 'milestone'
): string {
  // Tasks in cycle are highlighted in red
  if (taskId && tasksInCycle?.has(taskId)) {
    return 'bg-red-600 border-2 border-red-900'
  }

  // Delayed subtasks are red
  if (isSubtask && isDelayed) {
    return 'bg-red-600'
  }

  // ONDA 5.5: Tarefas tipo "Dependência" (wait) têm cor amarela diferenciada
  if (workType === 'wait') {
    return isSubtask ? 'bg-yellow-400' : 'bg-yellow-500 border-2 border-yellow-600'
  }

  // Default subtask color (mas apenas se não tiver work_type específico)
  if (isSubtask && type === 'subtarefa') {
    return 'bg-gray-400'
  }

  // Main task colors by type
  const colors: Record<string, string> = {
    'projeto_mecanico': 'bg-blue-500',
    'compras_mecanica': 'bg-purple-500',
    'projeto_eletrico': 'bg-yellow-500',
    'compras_eletrica': 'bg-orange-500',
    'fabricacao': 'bg-green-500',
    'tratamento_superficial': 'bg-pink-500',
    'montagem_mecanica': 'bg-indigo-500',
    'montagem_eletrica': 'bg-red-500',
    'coleta': 'bg-teal-500',
    'subtarefa': 'bg-gray-400'  // Fallback para subtarefas
  }

  return colors[type] || 'bg-gray-500'
}

/**
 * Gantt chart CSS styles
 */
export const ganttStyles = `
  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }

  .drag-handle {
    cursor: grab;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .dragging-row {
    opacity: 0.5;
    background: #e0f2fe;
  }

  .drag-over-row {
    border-top: 3px solid #3b82f6 !important;
    background: #eff6ff;
  }

  .resizing {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    cursor: ew-resize !important;
  }

  .task-bar-resizing {
    transition: none !important;
  }

  .task-bar-normal {
    transition: width 0.15s ease-out;
  }

  .glassmorphism-panel {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.15);
  }
`
