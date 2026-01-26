import React, { useMemo } from 'react'
import { Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { TaskEditCell } from './TaskEditCell'
import { TaskDurationCell } from './TaskDurationCell'
import { TaskCostCell } from './TaskCostCell'
import { TaskActionsMenu } from './TaskActionsMenu'
import { NewSubtaskRow } from './NewSubtaskRow'
import { WorkTypeCell } from '@/components/ui/WorkTypeSelect'
import { formatTaskType, getTaskColorClass } from './utils'
import { WorkType } from '@/utils/workType.utils'

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
  onOpenAllocation: (taskId: string, allocationId?: string) => void  // ONDA 3: allocationId opcional para edição
  calculateTotalCost: (taskId: string, field: 'estimated_cost' | 'actual_cost') => number
  // Subtask creation
  addingSubtaskTo: string | null
  newSubtaskData: { name: string; workType: WorkType; duration: number }  // ONDA 3: Added workType
  onSubtaskNameChange: (value: string) => void
  onSubtaskWorkTypeChange: (value: WorkType) => void  // ONDA 3: Added
  onSubtaskDurationChange: (value: number) => void
  onSaveSubtask: (parentId: string) => void
  onCancelSubtask: () => void
  isSavingSubtask: boolean
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
  onOpenAllocation,  // ONDA 1: Abrir modal de alocação
  calculateTotalCost,
  addingSubtaskTo,
  newSubtaskData,
  onSubtaskNameChange,
  onSubtaskWorkTypeChange,  // ONDA 3: Added
  onSubtaskDurationChange,
  onSaveSubtask,
  onCancelSubtask,
  isSavingSubtask
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

  // ONDA 3: Estado para controlar dropdown de fragmentos
  const [expandedResourceId, setExpandedResourceId] = React.useState<string | null>(null)

  // Fechar dropdown ao clicar fora
  React.useEffect(() => {
    const handleClickOutside = () => setExpandedResourceId(null)
    if (expandedResourceId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [expandedResourceId])

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

        {/* Categoria (Work Type) - ONDA 3 */}
        <td className="px-4 py-2">
          <WorkTypeCell
            value={task.work_type || 'work'}
            onChange={(newWorkType) => {
              // Atualizar work_type
              onFieldChange(task.id, 'work_type', newWorkType, task.work_type, task.name)

              // Se mudar para Checkpoint, forçar duration_minutes = 0
              if (newWorkType === 'milestone' && task.duration_minutes !== 0) {
                onFieldChange(task.id, 'duration_minutes', 0, task.duration_minutes, task.name)
              }
            }}
            disabled={false}
          />
        </td>

        {/* Duração - ONDA 2: TaskDurationCell */}
        <td className="px-4 py-2">
          <TaskDurationCell
            value={
              hasSubtasks
                ? (task.duration || 0) * 540  // Pai: mostrar duration (em dias) convertido para minutos
                : getCurrentValue(task.id, 'duration_minutes', task.duration_minutes)  // Filho: duration_minutes editável
            }
            onBlur={(minutes) => onFieldChange(task.id, 'duration_minutes', minutes, task.duration_minutes, task.name)}
            hasPendingChange={hasChange(task.id, 'duration_minutes')}
            workType={task.work_type}
            isReadOnly={hasSubtasks}
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

        {/* Pessoas - ONDA 3: Badges clicáveis para editar alocação */}
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1 flex-1">
              {(() => {
                // ONDA 3: Agrupar alocações por recurso para evitar duplicação em fragmentação
                const allocationsByResource = taskAllocations.reduce((acc, alloc) => {
                  const resourceId = alloc.resource_id
                  if (!acc[resourceId]) {
                    acc[resourceId] = []
                  }
                  acc[resourceId].push(alloc)
                  return acc
                }, {} as Record<string, typeof taskAllocations>)

                return Object.entries(allocationsByResource).map(([resourceId, allocs]) => {
                  const resource = resources.find(r => r.id === resourceId)
                  const isFragmented = allocs.length > 1
                  const isExpanded = expandedResourceId === resourceId

                  // Se não fragmentado, abrir modal diretamente
                  // Se fragmentado, expandir dropdown
                  const handleClick = () => {
                    if (isFragmented) {
                      setExpandedResourceId(isExpanded ? null : resourceId)
                    } else {
                      onOpenAllocation(task.id, allocs[0].id)
                    }
                  }

                  return (
                    <div key={resourceId} className="relative">
                      <button
                        onClick={handleClick}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors cursor-pointer"
                        title={isFragmented ? `${resource?.name || 'N/A'} - Fragmentado em ${allocs.length} alocações (clique para ver)` : 'Clique para editar alocação'}
                      >
                        <span>{resource?.name || 'N/A'}</span>
                        {isFragmented && (
                          <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-blue-600 text-white rounded-full font-bold">
                            {allocs.length}
                          </span>
                        )}
                      </button>

                      {/* Dropdown com fragmentos */}
                      {isFragmented && isExpanded && (
                        <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg min-w-[200px]">
                          <div className="p-2 border-b bg-gray-50 text-xs font-semibold text-gray-700">
                            Fragmentos de {resource?.name}
                          </div>
                          <div className="p-1">
                            {allocs
                              .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                              .map((alloc, index) => {
                                const hasOvertime = (alloc.overtime_minutes || 0) > 0
                                return (
                                  <button
                                    key={alloc.id}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onOpenAllocation(task.id, alloc.id)
                                      setExpandedResourceId(null)
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 rounded transition-colors flex items-center justify-between group"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        Fragmento {index + 1}/{allocs.length}
                                      </div>
                                      <div className="text-gray-500 mt-0.5">
                                        {new Date(alloc.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                        {' · '}
                                        {Math.floor((alloc.allocated_minutes || 0) / 60)}h{((alloc.allocated_minutes || 0) % 60).toString().padStart(2, '0')}m
                                        {hasOvertime && <span className="ml-1 text-orange-600 font-semibold">+ HORA EXTRA</span>}
                                      </div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                )
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
              {taskAllocations.length === 0 && (
                <span className="text-xs text-gray-400">Nenhuma</span>
              )}
            </div>
            {/* Botão para alocar recurso */}
            {!hasSubtasks && (
              <button
                onClick={() => onOpenAllocation(task.id)}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors text-sm font-semibold"
                title="Alocar recurso"
              >
                +
              </button>
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

        {/* Custo Estimado - Mantém editável */}
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

        {/* Custo Real - ONDA 1: TaskCostCell com comparação visual */}
        <td className="px-4 py-2 text-center">
          <TaskCostCell
            actualCost={hasSubtasks ? totalActualCost : (task.actual_cost || 0)}
            estimatedCost={hasSubtasks ? totalEstimatedCost : (task.estimated_cost || 0)}
            isReadOnly={hasSubtasks}
            hasPendingChange={hasChange(task.id, 'actual_cost')}
          />
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

      {/* Linha de nova subtarefa (se estiver adicionando) */}
      {addingSubtaskTo === task.id && (
        <NewSubtaskRow
          name={newSubtaskData.name}
          workType={newSubtaskData.workType}  // ONDA 3: Added
          duration={newSubtaskData.duration}
          parentLevel={level}
          onNameChange={onSubtaskNameChange}
          onWorkTypeChange={onSubtaskWorkTypeChange}  // ONDA 3: Added
          onDurationChange={onSubtaskDurationChange}
          onSave={() => onSaveSubtask(task.id)}
          onCancel={onCancelSubtask}
          isSaving={isSavingSubtask}
        />
      )}

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
          onOpenAllocation={onOpenAllocation}
          calculateTotalCost={calculateTotalCost}
          addingSubtaskTo={addingSubtaskTo}
          newSubtaskData={newSubtaskData}
          onSubtaskNameChange={onSubtaskNameChange}
          onSubtaskWorkTypeChange={onSubtaskWorkTypeChange}  // ONDA 3: Added
          onSubtaskDurationChange={onSubtaskDurationChange}
          onSaveSubtask={onSaveSubtask}
          onCancelSubtask={onCancelSubtask}
          isSavingSubtask={isSavingSubtask}
        />
      ))}
    </>
  )
})
