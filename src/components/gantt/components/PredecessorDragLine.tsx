/**
 * Linha visual que segue o mouse durante drag de predecessor
 * ONDA 5.7: "Corda" que conecta âncora ao ponteiro
 */

import React, { useEffect, useRef } from 'react'
import { PredecessorDragState } from '../hooks/usePredecessorEditing'

interface PredecessorDragLineProps {
  dragState: PredecessorDragState
  containerRef: React.RefObject<HTMLElement>
}

/**
 * Renderiza uma linha SVG que conecta a âncora de origem ao cursor do mouse
 *
 * Aparece apenas quando isDragging === true
 */
export function PredecessorDragLine({
  dragState,
  containerRef
}: PredecessorDragLineProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Não renderizar se não estiver arrastando
  if (!dragState.isActive) return null

  // Calcular posição da âncora de origem (simplificado - será refinado)
  // TODO: Calcular posição real da âncora baseado no taskId e anchor type
  const startX = dragState.mouseX
  const startY = dragState.mouseY
  const endX = dragState.mouseX
  const endY = dragState.mouseY

  return (
    <svg
      ref={svgRef}
      className="fixed inset-0 pointer-events-none z-[60]"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Linha tracejada animada */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="#3b82f6"
        strokeWidth="2"
        strokeDasharray="5,5"
        strokeLinecap="round"
      >
        {/* Animação de "formiga marchante" */}
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="10"
          dur="0.5s"
          repeatCount="indefinite"
        />
      </line>

      {/* Círculo no final (cursor) */}
      <circle
        cx={endX}
        cy={endY}
        r="6"
        fill="#3b82f6"
        opacity="0.6"
      />
    </svg>
  )
}
