/**
 * Âncora visual para conectar predecessores
 * ONDA 5.7: Círculos clicáveis para drag & drop de predecessores
 */

import React from 'react'
import { AnchorType } from '../hooks/usePredecessorEditing'

interface TaskAnchorProps {
  taskId: string
  type: AnchorType  // 'start' | 'end'
  position: 'left' | 'right'  // Posição física no visual
  isActive: boolean  // Se está em modo de edição
  isDragging: boolean  // Se está sendo arrastado
  onMouseDown: (taskId: string, anchor: AnchorType, event: React.MouseEvent) => void
  onMouseUp: (taskId: string, anchor: AnchorType) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

/**
 * Componente de âncora para criar predecessores
 *
 * Visual:
 * - Círculo pequeno que aparece apenas em modo de edição
 * - Verde para início, Azul para fim
 * - Hover: aumenta e mostra tooltip
 * - Dragging: efeito de "arrasto"
 */
export function TaskAnchor({
  taskId,
  type,
  position,
  isActive,
  isDragging,
  onMouseDown,
  onMouseUp,
  onMouseEnter,
  onMouseLeave
}: TaskAnchorProps) {
  // Não renderizar se não estiver ativo
  if (!isActive) return null

  const isStart = type === 'start'
  const anchorLabel = isStart ? 'Início' : 'Fim'

  // Cores baseadas no tipo
  const colorClasses = isStart
    ? 'bg-green-500 border-green-700 hover:bg-green-600'
    : 'bg-blue-500 border-blue-700 hover:bg-blue-600'

  // Posicionamento: esquerda ou direita
  const positionClasses = position === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'

  return (
    <div
      className={`
        absolute top-1/2 -translate-y-1/2 ${positionClasses}
        w-3 h-3 rounded-full border-2
        ${colorClasses}
        ${isDragging ? 'scale-150 shadow-lg z-50' : 'scale-100 hover:scale-125'}
        transition-all duration-150 cursor-pointer
        group
      `}
      onMouseDown={(e) => {
        e.stopPropagation()  // Não interferir com drag da barra
        onMouseDown(taskId, type, e)
      }}
      onMouseUp={(e) => {
        e.stopPropagation()
        onMouseUp(taskId, type)
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={`${anchorLabel} - Arraste para conectar`}
    >
      {/* Tooltip on hover */}
      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block pointer-events-none">
        <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
          {anchorLabel}
        </div>
      </div>
    </div>
  )
}
