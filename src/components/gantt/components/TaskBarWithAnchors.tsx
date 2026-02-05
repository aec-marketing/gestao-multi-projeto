/**
 * Wrapper para barra de tarefa com âncoras de predecessor
 * ONDA 5.7: Adiciona círculos de ancoragem quando em modo de edição
 */

import React, { useState } from 'react'
import { TaskAnchor } from './TaskAnchor'
import { AnchorType } from '../hooks/usePredecessorEditing'

interface TaskBarWithAnchorsProps {
  taskId: string
  children: React.ReactNode
  isEditingMode: boolean
  onAnchorMouseDown: (taskId: string, anchor: AnchorType, event: React.MouseEvent) => void
  onAnchorMouseUp: (taskId: string, anchor: AnchorType) => void
  isDragging: boolean
}

/**
 * Componente wrapper que adiciona âncoras visuais às barras de tarefas
 *
 * Quando `isEditingMode` é true, renderiza dois círculos:
 * - Verde à esquerda (âncora de início)
 * - Azul à direita (âncora de fim)
 */
export function TaskBarWithAnchors({
  taskId,
  children,
  isEditingMode,
  onAnchorMouseDown,
  onAnchorMouseUp,
  isDragging
}: TaskBarWithAnchorsProps) {
  const [hoveredAnchor, setHoveredAnchor] = useState<AnchorType | null>(null)

  return (
    <div className="relative">
      {children}

      {/* Âncora de INÍCIO (esquerda) */}
      <TaskAnchor
        taskId={taskId}
        type="start"
        position="left"
        isActive={isEditingMode}
        isDragging={isDragging && hoveredAnchor === 'start'}
        onMouseDown={onAnchorMouseDown}
        onMouseUp={onAnchorMouseUp}
        onMouseEnter={() => setHoveredAnchor('start')}
        onMouseLeave={() => setHoveredAnchor(null)}
      />

      {/* Âncora de FIM (direita) */}
      <TaskAnchor
        taskId={taskId}
        type="end"
        position="right"
        isActive={isEditingMode}
        isDragging={isDragging && hoveredAnchor === 'end'}
        onMouseDown={onAnchorMouseDown}
        onMouseUp={onAnchorMouseUp}
        onMouseEnter={() => setHoveredAnchor('end')}
        onMouseLeave={() => setHoveredAnchor(null)}
      />
    </div>
  )
}
