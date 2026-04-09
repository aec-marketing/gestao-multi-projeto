import React, { useMemo, useState } from 'react'
import { Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { TaskEditCell } from './TaskEditCell'
import { TaskDurationCell } from './TaskDurationCell'
import { TaskCostCell } from './TaskCostCell'
import { TaskActionsMenu } from './TaskActionsMenu'
import { NewSubtaskRow } from './NewSubtaskRow'
import { WorkTypeCell } from '@/components/ui/WorkTypeSelect'
import { TaskTypeCell } from './TaskTypeCell'
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
  calculateTotalCost: (taskId: string) => number
  // Subtask creation
  addingSubtaskTo: string | null
  newSubtaskData: { name: string; workType: WorkType; duration: number }  // ONDA 3: Added workType
  onSubtaskNameChange: (value: string) => void
  onSubtaskWorkTypeChange: (value: WorkType) => void  // ONDA 3: Added
  onSubtaskDurationChange: (value: number) => void
  onSaveSubtask: (parentId: string) => void
  onCancelSubtask: () => void
  isSavingSubtask: boolean
  onCloseSubtasks: (taskId: string, taskName: string, subtaskCount: number) => void
  onEditList?: (taskId: string) => void
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
  isSavingSubtask,
  onCloseSubtasks,
  onEditList
}: TaskRowProps) {
  // Subtasks
  const subtasks = useMemo(
    () => allTasks.filter(t => t.parent_id === task.id),
    [allTasks, task.id]
  )
  const hasSubtasks = subtasks.length > 0

  // Progresso local para o slider (folhas apenas)
  const [localProgress, setLocalProgress] = useState(task.progress ?? 0)

  // Duração exibida do pai = span (max_end - min_start + 1) calculado dos filhos
  // Nunca soma durações — igual ao Gantt
  const spanDurationMinutes = useMemo(() => {
    if (!hasSubtasks || subtasks.length === 0) return task.duration_minutes || 0
    const starts = subtasks.map(s => s.start_date ? new Date(s.start_date).getTime() : null).filter(Boolean) as number[]
    const ends = subtasks.map(s => {
      if (!s.start_date || !s.duration_minutes) return null
      const start = new Date(s.start_date).getTime()
      const minutesPerDay = s.work_type === 'wait' ? 1440 : 540
      return start + (s.duration_minutes / minutesPerDay - 1) * 86400000
    }).filter(Boolean) as number[]
    if (starts.length === 0 || ends.length === 0) return task.duration_minutes || 0
    const spanDays = Math.round((Math.max(...ends) - Math.min(...starts)) / 86400000) + 1
    const minutesPerDay = task.work_type === 'wait' ? 1440 : 540
    return spanDays * minutesPerDay
  }, [hasSubtasks, task.duration_minutes, task.work_type, subtasks])

  // Indentação
  const indentLevel = task.outline_level || level
  const indent = indentLevel * 30

  // Custo total para tarefas pai (estimated + alocação, recursivo)
  const totalEstimatedCost = useMemo(
    () => hasSubtasks ? calculateTotalCost(task.id) : 0,
    [hasSubtasks, task.id, calculateTotalCost]
  )

  // Custo por alocação (calculado client-side): soma de allocated_minutes * hourly_rate
  const allocationCost = useMemo(() => {
    const taskAllocs = allocations.filter(a => a.task_id === task.id)
    return taskAllocs.reduce((sum, alloc) => {
      const resource = resources.find(r => r.id === alloc.resource_id)
      if (!resource) return sum
      const minutes = alloc.allocated_minutes ?? task.duration_minutes ?? 0
      const overtime = alloc.overtime_minutes ?? 0
      const multiplier = alloc.overtime_multiplier ?? 1.5
      return sum + (minutes / 60) * resource.hourly_rate + (overtime / 60) * resource.hourly_rate * multiplier
    }, 0)
  }, [allocations, task.id, task.duration_minutes, resources])

  // Task allocations
  const taskAllocations = useMemo(
    () => allocations.filter(a => a.task_id === task.id),
    [allocations, task.id]
  )

  // 🌊 ONDA 5.2: Removido dropdown - clique agora abre Planner diretamente

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
          <TaskTypeCell
            value={task.type as any}
            onChange={(newValue) => onFieldChange(task.id, 'type', newValue, task.type, task.name)}
            disabled={hasSubtasks}
            hasPendingChange={hasChange(task.id, 'type')}
          />
        </td>

        {/* Categoria (Work Type) - ONDA 3 */}
        <td className="px-4 py-2">
          <WorkTypeCell
            value={getCurrentValue(task.id, 'work_type', task.work_type || 'work')}
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
                ? spanDurationMinutes  // Pai: span calculado dos filhos
                : getCurrentValue(task.id, 'duration_minutes', task.duration_minutes)  // Filho: duration_minutes editável
            }
            onBlur={(minutes) => onFieldChange(task.id, 'duration_minutes', minutes, task.duration_minutes, task.name)}
            hasPendingChange={hasChange(task.id, 'duration_minutes')}
            workType={getCurrentValue(task.id, 'work_type', task.work_type)}
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

        {/* Pessoas - 🌊 ONDA 5.2: Badges clicáveis abrem Planner diretamente (sem dropdown) */}
        <td className="px-4 py-2">
          {task.type === 'lista_compras' ? (
            <span className="text-xs text-gray-300">—</span>
          ) : (
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1 flex-1">
              {(() => {
                // Agrupar alocações por recurso para evitar duplicação em fragmentação
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

                  // 🌊 ONDA 5.2: Abre modal de alocação (que mostra fragmentos e botão "Editar")
                  const handleClick = () => {
                    onOpenAllocation(task.id)
                  }

                  return (
                    <button
                      key={resourceId}
                      onClick={handleClick}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors cursor-pointer"
                      title={isFragmented ? `${resource?.name || 'N/A'} - ${allocs.length} fragmento(s) · Clique para ver detalhes` : 'Clique para ver detalhes da alocação'}
                    >
                      <span>{resource?.name || 'N/A'}</span>
                      {isFragmented && (
                        <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-blue-600 text-white rounded-full font-bold">
                          {allocs.length}
                        </span>
                      )}
                    </button>
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
          )}
        </td>

        {/* Progresso */}
        <td className="px-4 py-2">
          {hasSubtasks ? (
            // Tarefa pai: progresso derivado dos filhos (read-only) + botão encerrar
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Média filhos</span>
                  <span className={`text-xs font-bold ${task.progress === 100 ? 'text-green-600' : 'text-gray-700'}`}>
                    {task.progress}%
                  </span>
                </div>
                <div className="bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${task.progress === 100 ? 'bg-green-500' : 'bg-blue-400'}`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
              {task.progress < 100 && (
                <button
                  onClick={() => onCloseSubtasks(task.id, task.name, subtasks.length)}
                  className="shrink-0 px-2 py-1 text-[10px] font-medium bg-green-50 text-green-700 border border-green-300 rounded hover:bg-green-100 transition-colors"
                  title="Marcar todas as subtarefas como 100% concluídas"
                >
                  ✓ Encerrar
                </button>
              )}
            </div>
          ) : (
            // Tarefa folha: slider editável — integrado ao sistema de batch (highlight + BatchSaveBar)
            <div className={`flex items-center gap-2 min-w-[120px] rounded px-1 py-0.5 transition-colors ${hasChange(task.id, 'progress') ? 'bg-yellow-50 ring-1 ring-yellow-300' : ''}`}>
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={localProgress}
                  onChange={(e) => setLocalProgress(Number(e.target.value))}
                  onMouseUp={(e) => {
                    const val = Number((e.target as HTMLInputElement).value)
                    onFieldChange(task.id, 'progress', val, task.progress, task.name)
                  }}
                  onTouchEnd={(e) => {
                    const val = Number((e.target as HTMLInputElement).value)
                    onFieldChange(task.id, 'progress', val, task.progress, task.name)
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500"
                  style={{
                    background: `linear-gradient(to right, ${localProgress === 100 ? '#22c55e' : '#3b82f6'} ${localProgress}%, #e5e7eb ${localProgress}%)`
                  }}
                />
              </div>
              <span className={`text-xs font-bold w-8 text-right shrink-0 ${localProgress === 100 ? 'text-green-600' : 'text-gray-700'}`}>
                {localProgress}%
              </span>
            </div>
          )}
        </td>

        {/* Custo — editável em tarefas folha, soma (Σ) em tarefas pai */}
        <td className="px-4 py-2 text-right">
          {hasSubtasks ? (
            <TaskCostCell
              cost={totalEstimatedCost}
              isReadOnly={true}
            />
          ) : (
            <div className="space-y-1">
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
              {allocationCost > 0 && (
                <div
                  className="text-xs text-purple-600 text-right"
                  title={`Custo por alocação de pessoas: R$ ${allocationCost.toFixed(2)}`}
                >
                  +R$ {allocationCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 👥
                </div>
              )}
            </div>
          )}
        </td>

        {/* Ações */}
        <td className="px-4 py-2">
          <TaskActionsMenu
            taskId={task.id}
            taskName={task.name}
            hasSubtasks={hasSubtasks}
            isPurchaseList={task.type === 'lista_compras'}
            onAddSubtask={onAddSubtask}
            onDelete={onDelete}
            onEditList={onEditList}
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
          onCloseSubtasks={onCloseSubtasks}
          onEditList={onEditList}
        />
      ))}
    </>
  )
})
