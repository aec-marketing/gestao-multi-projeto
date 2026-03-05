/**
 * Linha de tarefa completa no Gantt (ONDA 2)
 * Renderiza: lado esquerdo (nome, botões) + lado direito (barra visual)
 */

import React from 'react'
import { TaskWithAllocations } from '../types/gantt.types'
import { GanttTaskBar } from './GanttTaskBar'
import { getTaskColor } from '../utils/ganttColors'
import { calculateTaskBarStyle, calculateAllocationBarStyle } from '../utils/ganttCalculations'
import { Task } from '@/types/database.types'

interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string
  lag_time: number
  lag_minutes?: number
}

interface GanttTaskRowProps {
  task: TaskWithAllocations
  level: number
  dateRange: { minDate: Date; maxDate: Date }
  columnWidth: number

  // Estado visual
  isSelected: boolean
  isExpanded: boolean
  isDragging: boolean
  isDragOver: boolean
  isResizing: boolean
  isInCycle: boolean
  isLate: boolean

  // Valores temporários durante interação
  tempDuration?: number
  tempStartOffset?: number

  // Pending changes (para preview fantasma)
  pendingChanges?: {
    start_date?: string
    end_date?: string
    duration_minutes?: number
  }

  // Para detecção de conflitos
  allTasks?: Task[]
  predecessors?: Predecessor[]

  // Handlers
  onToggleExpand: () => void
  onSelect: () => void
  onResizeStart: (edge: 'start' | 'end', e: React.MouseEvent) => void
  onDragStart: () => void
  onDragOver: () => void
  onDragEnd: () => void
  onDrop: () => void

  // Ações contextuais
  onAddSubtask: () => void
  onAllocate: () => void
  onEditCosts: () => void
  onDelete: () => void
}

export const GanttTaskRow = React.memo(function GanttTaskRow({
  task,
  level,
  dateRange,
  columnWidth,
  isSelected,
  isExpanded,
  isDragging,
  isDragOver,
  isResizing,
  isInCycle,
  isLate,
  tempDuration,
  tempStartOffset,
  pendingChanges,
  allTasks,
  predecessors,
  onToggleExpand,
  onSelect,
  onResizeStart,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onAddSubtask,
  onAllocate,
  onEditCosts,
  onDelete
}: GanttTaskRowProps) {
  // DEBUG: Log SEMPRE para ver se o componente renderiza
  console.log('[GANTT-ROW-DEBUG] Renderizando:', task.name)

  const hasSubtasks = task.subtasks && task.subtasks.length > 0
  const isParent = hasSubtasks

  // ONDA 3: Detectar fragmentação
  // Só fragmentar se NÃO for tarefa pai (pai sempre mostra barra única longa)
  const allocations = task.allocations || []
  const isFragmented = !isParent && allocations.length > 1

  // DEBUG: Log TODAS as tarefas
  console.log('[FRAGMENT-DEBUG] Tarefa:', task.name, {
    hasAllocationsProperty: 'allocations' in task,
    allocationsIsArray: Array.isArray(task.allocations),
    allocationsLength: allocations.length,
    taskId: task.id,
    isParent
  })

  // DEBUG: Se tiver alocações, mostrar detalhes
  if (allocations.length > 0) {
    console.log('[FRAGMENT-DEBUG] ✅ COM alocações:', task.name, {
      totalAllocations: allocations.length,
      isFragmented,
      dates: allocations.map(a => ({ start: a.start_date, end: a.end_date }))
    })
  }

  // Ordenar alocações por data para fragmentos
  const sortedAllocations = isFragmented
    ? [...allocations].sort((a, b) =>
        new Date(a.start_date ?? '').getTime() - new Date(b.start_date ?? '').getTime()
      )
    : allocations

  // Calcular estilo da barra (usado se NÃO fragmentada)
  const barStyle = calculateTaskBarStyle(
    task,
    dateRange,
    columnWidth,
    tempDuration,
    tempStartOffset
  )

  // Cor da barra
  const barColor = getTaskColor(
    task.type,
    !!task.parent_id, // isSubtask
    isLate,
    task.id,
    isInCycle ? new Set([task.id]) : undefined,
    task.work_type // ONDA 5.5: Passar work_type para coloração diferenciada
  )

  return (
    <div
      className={`
        flex border-b border-gray-100 hover:bg-gray-50 transition-colors
        ${isDragging ? 'dragging-row' : ''}
        ${isDragOver ? 'drag-over-row' : ''}
        ${isSelected ? 'bg-blue-50' : ''}
      `}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDrop={onDrop}
    >
      {/* ========== LADO ESQUERDO: Nome e Ações ========== */}
      <div className="w-80 border-r bg-white flex items-center px-2 py-1 sticky left-0 z-10">
        {/* Indentação hierárquica */}
        <div style={{ width: `${level * 20}px` }} className="flex-shrink-0" />

        {/* Botão expand/collapse */}
        {isParent && (
          <button
            onClick={onToggleExpand}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
          >
            <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
          </button>
        )}

        {/* Se não é pai, adicionar espaço */}
        {!isParent && <div className="w-5 flex-shrink-0" />}

        {/* Drag handle */}
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="drag-handle flex-shrink-0 cursor-grab active:cursor-grabbing ml-1 mr-2 text-gray-400 hover:text-gray-600"
          title="Arrastar para reordenar"
        >
          ⋮⋮
        </div>

        {/* Nome da tarefa */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={`text-sm truncate ${isParent ? 'font-semibold' : ''} ${
              task.progress === 100 ? 'text-green-700' : 'text-gray-900'
            }`}
            title={task.name}
          >
            {task.name}
          </span>

          {/* Badges */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Badge de progresso 100% */}
            {task.progress === 100 && (
              <span className="text-white text-[10px] font-bold bg-green-600 px-1 rounded">
                ✓
              </span>
            )}

            {/* Badge de atraso */}
            {isLate && (
              <span className="text-white text-[10px] font-bold bg-red-600 px-1 rounded">
                ATRASO
              </span>
            )}

            {/* Badge de ciclo */}
            {isInCycle && (
              <span className="text-white text-[10px] font-bold bg-red-900 px-1 rounded animate-pulse">
                CICLO
              </span>
            )}
          </div>
        </div>

        {/* Botões de ação (aparecem no hover) */}
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
          {/* Adicionar subtarefa */}
          {isParent && (
            <button
              onClick={onAddSubtask}
              className="w-6 h-6 flex items-center justify-center hover:bg-blue-100 rounded text-blue-600 text-xs"
              title="Adicionar subtarefa"
            >
              +
            </button>
          )}

          {/* Alocar recursos */}
          <button
            onClick={onAllocate}
            className="w-6 h-6 flex items-center justify-center hover:bg-purple-100 rounded text-purple-600 text-xs"
            title="Alocar recursos"
          >
            👤
          </button>

          {/* Editar custos */}
          <button
            onClick={onEditCosts}
            className="w-6 h-6 flex items-center justify-center hover:bg-yellow-100 rounded text-yellow-600 text-xs"
            title="Editar custos"
          >
            💰
          </button>

          {/* Deletar */}
          <button
            onClick={onDelete}
            className="w-6 h-6 flex items-center justify-center hover:bg-red-100 rounded text-red-600 text-xs"
            title="Deletar tarefa"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* ========== LADO DIREITO: Barra Visual ========== */}
      <div className="flex-1 relative py-1" onClick={onSelect}>
        {/* Linha de conexão do nome até a barra */}
        <div
          className="absolute top-1/2 left-0 h-px bg-gray-300 pointer-events-none"
          style={{
            width: isFragmented
              ? calculateAllocationBarStyle(sortedAllocations[0], dateRange, columnWidth).left
              : barStyle.left,
            transform: 'translateY(-50%)'
          }}
        />

        {/* ONDA 3: Renderizar barras fragmentadas OU barra única */}
        {isFragmented ? (
          // TAREFA FRAGMENTADA: Múltiplas barras (uma por alocação)
          sortedAllocations.map((allocation, index) => {
            const fragmentStyle = calculateAllocationBarStyle(allocation, dateRange, columnWidth)
            const isFirst = index === 0
            const isLast = index === sortedAllocations.length - 1

            return (
              <React.Fragment key={allocation.id}>
                {/* Barra do fragmento */}
                <GanttTaskBar
                  task={task}
                  style={fragmentStyle}
                  color={barColor}
                  isSelected={isSelected}
                  isResizing={false}  // Fragmentos não redimensionáveis (por enquanto)
                  tempDuration={undefined}
                  allTasks={allTasks}
                  predecessors={predecessors}
                  onResizeStart={onResizeStart}
                  onClick={onSelect}
                  // ONDA 3: Props de fragmentação
                  isFragment={true}
                  fragmentIndex={index}
                  totalFragments={sortedAllocations.length}
                  fragmentLabel={isFirst ? task.name : `↳ ${task.name}`}
                />

                {/* Linha conectora entre fragmentos */}
                {!isLast && (() => {
                  const currentEnd = parseFloat(fragmentStyle.left as string) + parseFloat(fragmentStyle.width as string)
                  const nextStart = parseFloat(calculateAllocationBarStyle(sortedAllocations[index + 1], dateRange, columnWidth).left as string)
                  const gapWidth = nextStart - currentEnd

                  return (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: `${currentEnd}px`,
                        width: `${gapWidth}px`,
                        top: '24px',
                        height: '2px',
                        borderTop: `2px dashed ${barColor}`,
                        zIndex: 1
                      }}
                    >
                      {/* Seta no final da linha */}
                      <div
                        className="absolute right-[-6px] top-[-4px] text-xs font-bold"
                        style={{ color: barColor }}
                      >
                        →
                      </div>
                    </div>
                  )
                })()}
              </React.Fragment>
            )
          })
        ) : (
          // TAREFA NORMAL: Barra única
          <GanttTaskBar
            task={task}
            style={barStyle}
            color={barColor}
            isSelected={isSelected}
            isResizing={isResizing}
            tempDuration={tempDuration}
            allTasks={allTasks}
            predecessors={predecessors}
            onResizeStart={onResizeStart}
            onClick={onSelect}
          />
        )}

        {/* PREVIEW FANTASMA de mudanças pendentes (quando não está em resize ativo) */}
        {pendingChanges && !isResizing && (() => {
          // Calcular posição da barra fantasma baseado nas mudanças pendentes
          const ghostTask = { ...task, ...pendingChanges }

          // Converter duration_minutes para days se necessário
          if (pendingChanges.duration_minutes !== undefined) {
            ghostTask.duration_days = pendingChanges.duration_minutes / 540
          }

          const ghostStyle = calculateTaskBarStyle(
            ghostTask as any,
            dateRange,
            columnWidth
          )

          // Detectar se a duração aumentou ou diminuiu
          const originalDuration = task.duration_minutes || 540
          const newDuration = pendingChanges.duration_minutes || originalDuration
          const isExpanding = newDuration > originalDuration
          const isShrinking = newDuration < originalDuration

          return (
            <>
              {/* Barra fantasma ORIGINAL (quando está expandindo) - mostra onde estava */}
              {isExpanding && (
                <div
                  style={{
                    ...barStyle,
                    zIndex: 5,
                    opacity: 0.3,
                    pointerEvents: 'none'
                  }}
                  className={`absolute rounded-md border-2 border-dashed ${barColor}`}
                  title="Posição original"
                />
              )}

              {/* Barra fantasma NOVA - mostra onde vai ficar */}
              <div
                style={{
                  ...ghostStyle,
                  zIndex: 6,
                  opacity: 0.5,
                  pointerEvents: 'none'
                }}
                className={`absolute rounded-md border-2 border-dashed ${
                  isExpanding ? 'border-green-500 bg-green-200' :
                  isShrinking ? 'border-orange-500 bg-orange-200' :
                  'border-blue-500 bg-blue-200'
                }`}
                title={`Nova duração: ${((newDuration / 540).toFixed(2))} dias`}
              >
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs font-bold">
                    {isExpanding && '→'}
                    {isShrinking && '←'}
                    {!isExpanding && !isShrinking && '📅'}
                  </span>
                </div>
              </div>
            </>
          )
        })()}

        {/* Indicador de resize em tempo real */}
        {tempDuration !== undefined && isResizing && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-1 rounded shadow-lg text-xs font-semibold whitespace-nowrap z-20">
            {tempDuration.toFixed(3)} dias
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Comparador customizado para performance
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.name === nextProps.task.name &&
    prevProps.task.duration_minutes === nextProps.task.duration_minutes &&
    prevProps.task.progress === nextProps.task.progress &&
    prevProps.level === nextProps.level &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isDragOver === nextProps.isDragOver &&
    prevProps.isResizing === nextProps.isResizing &&
    prevProps.isInCycle === nextProps.isInCycle &&
    prevProps.isLate === nextProps.isLate &&
    prevProps.tempDuration === nextProps.tempDuration &&
    prevProps.tempStartOffset === nextProps.tempStartOffset &&
    prevProps.columnWidth === nextProps.columnWidth &&
    prevProps.dateRange.minDate.getTime() === nextProps.dateRange.minDate.getTime() &&
    prevProps.dateRange.maxDate.getTime() === nextProps.dateRange.maxDate.getTime() &&
    JSON.stringify(prevProps.pendingChanges) === JSON.stringify(nextProps.pendingChanges)
  )
})
