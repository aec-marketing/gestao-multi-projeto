import React, { useMemo } from 'react'
import { Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { TaskEditCell } from './TaskEditCell'
import { TaskActionsMenu } from './TaskActionsMenu'
import { formatTaskType, getTaskColorClass } from './utils'

interface TaskRowProps {
  task: Task
  level: number
  allTasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  hasChange: (taskId: string, field: string) => boolean
  getCurrentValue: (taskId: string, field: string, originalValue: any) => any
  onFieldChange: (taskId: string, field: string, value: any, originalValue: any, taskName: string) => void
  onAddSubtask: (taskId: string) => void
  onDelete: (taskId: string, taskName: string, hasSubtasks: boolean) => void
  calculateTotalCost: (taskId: string, field: 'estimated_cost' | 'actual_cost') => number
}

/**
 * Componente recursivo para renderizar uma linha de tarefa
 * Inclui suporte para hierarquia (tarefas pai e subtarefas)
 */
export const TaskRow = React.memo(function TaskRow({
  task,
  level,
  allTasks,
  resources,
  allocations,
  hasChange,
  getCurrentValue,
  onFieldChange,
  onAddSubtask,
  onDelete,
  calculateTotalCost
}: TaskRowProps) {
  // Subtasks
  const subtasks = useMemo(
    () => allTasks.filter(t => t.parent_id === task.id),
    [allTasks, task.id]
  )
  const hasSubtasks = subtasks.length > 0

  // Indentação
  const indentLevel = task.outline_level || level
  const indent = indentLevel * 30

  // Cost totals para tarefas pai
  const totalEstimatedCost = useMemo(
    () => hasSubtasks ? calculateTotalCost(task.id, 'estimated_cost') : 0,
    [hasSubtasks, task.id, calculateTotalCost]
  )

  const totalActualCost = useMemo(
    () => hasSubtasks ? calculateTotalCost(task.id, 'actual_cost') : 0,
    [hasSubtasks, task.id, calculateTotalCost]
  )

  // Task allocations
  const taskAllocations = useMemo(
    () => allocations.filter(a => a.task_id === task.id),
    [allocations, task.id]
  )

  return (
    <>
      <tr className={hasSubtasks ? 'bg-gray-50 font-medium' : 'hover:bg-gray-50 transition-colors'}>
        {/* WBS */}
        <td className="px-4 py-2 text-xs text-gray-500 font-mono">
          {task.wbs_code || '-'}
        </td>

        {/* Nome com indentação */}
        <td className="px-4 py-2">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${indent}px` }}>
            {level > 0 && <span className="text-gray-400">└─</span>}
            <TaskEditCell
              value={getCurrentValue(task.id, 'name', task.name)}
              type="text"
              onBlur={(value) => onFieldChange(task.id, 'name', value, task.name, task.name)}
              hasPendingChange={hasChange(task.id, 'name')}
              className="flex-1"
            />
          </div>
        </td>

        {/* Tipo */}
        <td className="px-4 py-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${getTaskColorClass(task.type)}`}>
            {formatTaskType(task.type)}
          </span>
        </td>

        {/* Duração */}
        <td className="px-4 py-2 text-center">
          <TaskEditCell
            value={getCurrentValue(task.id, 'duration', task.duration)}
            type="number"
            min={0.125}
            step={0.125}
            onBlur={(value) => onFieldChange(task.id, 'duration', value, task.duration, task.name)}
            hasPendingChange={hasChange(task.id, 'duration')}
          />
        </td>

        {/* Start Date */}
        <td className="px-4 py-2 text-center">
          <TaskEditCell
            value={getCurrentValue(task.id, 'start_date', task.start_date || '')}
            type="date"
            onBlur={(value) => onFieldChange(task.id, 'start_date', value, task.start_date, task.name)}
            hasPendingChange={hasChange(task.id, 'start_date')}
          />
        </td>

        {/* End Date */}
        <td className="px-4 py-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <TaskEditCell
              value={getCurrentValue(task.id, 'end_date', task.end_date || '')}
              type="date"
              onBlur={(value) => onFieldChange(task.id, 'end_date', value, task.end_date, task.name)}
              hasPendingChange={hasChange(task.id, 'end_date')}
            />
            {/* Lag Badge */}
            {task.lag_days > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded border border-green-300">
                +{task.lag_days}
              </span>
            )}
          </div>
        </td>

        {/* Pessoas */}
        <td className="px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {taskAllocations.map(alloc => {
              const resource = resources.find(r => r.id === alloc.resource_id)
              return (
                <span
                  key={alloc.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium"
                >
                  {resource?.name || 'N/A'}
                </span>
              )
            })}
            {taskAllocations.length === 0 && (
              <span className="text-xs text-gray-400">Nenhuma</span>
            )}
          </div>
        </td>

        {/* Progresso */}
        <td className="px-4 py-2">
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-10 text-right font-medium">
              {task.progress}%
            </span>
          </div>
        </td>

        {/* Custo Estimado */}
        <td className="px-4 py-2 text-right">
          {hasSubtasks ? (
            <div className="flex items-center justify-end gap-1">
              <span className="text-xs text-gray-500">R$</span>
              <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-sm font-semibold">
                {totalEstimatedCost.toFixed(2)}
              </span>
              <span className="text-xs text-gray-400" title="Soma das subtarefas">(Σ)</span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <span className="text-xs text-gray-500">R$</span>
              <TaskEditCell
                value={getCurrentValue(task.id, 'estimated_cost', task.estimated_cost || '')}
                type="number"
                min={0}
                step={0.01}
                placeholder="0,00"
                onBlur={(value) => onFieldChange(task.id, 'estimated_cost', value, task.estimated_cost, task.name)}
                hasPendingChange={hasChange(task.id, 'estimated_cost')}
                className="w-24 text-right"
              />
            </div>
          )}
        </td>

        {/* Custo Real */}
        <td className="px-4 py-2 text-right">
          {hasSubtasks ? (
            <div className="flex items-center justify-end gap-1">
              <span className="text-xs text-gray-500">R$</span>
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm font-semibold">
                {totalActualCost.toFixed(2)}
              </span>
              <span className="text-xs text-gray-400" title="Soma das subtarefas">(Σ)</span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <span className="text-xs text-gray-500">R$</span>
              <TaskEditCell
                value={getCurrentValue(task.id, 'actual_cost', task.actual_cost || '')}
                type="number"
                min={0}
                step={0.01}
                placeholder="0,00"
                onBlur={(value) => onFieldChange(task.id, 'actual_cost', value, task.actual_cost, task.name)}
                hasPendingChange={hasChange(task.id, 'actual_cost')}
                className="w-24 text-right"
              />
            </div>
          )}
        </td>

        {/* Ações */}
        <td className="px-4 py-2">
          <TaskActionsMenu
            taskId={task.id}
            taskName={task.name}
            hasSubtasks={hasSubtasks}
            onAddSubtask={onAddSubtask}
            onDelete={onDelete}
          />
        </td>
      </tr>

      {/* Renderização recursiva das subtarefas */}
      {subtasks.map(subtask => (
        <TaskRow
          key={subtask.id}
          task={subtask}
          level={level + 1}
          allTasks={allTasks}
          resources={resources}
          allocations={allocations}
          hasChange={hasChange}
          getCurrentValue={getCurrentValue}
          onFieldChange={onFieldChange}
          onAddSubtask={onAddSubtask}
          onDelete={onDelete}
          calculateTotalCost={calculateTotalCost}
        />
      ))}
    </>
  )
})
