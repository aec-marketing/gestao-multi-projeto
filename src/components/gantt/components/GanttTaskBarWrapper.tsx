/**
 * Wrapper inteligente para barras de tarefa com suporte a edição de predecessores
 * ONDA 5.7: Encapsula toda a lógica de âncoras e drag de predecessores
 *
 * USO:
 * <GanttTaskBarWrapper taskId={task.id} editingMode={true} onConnectionComplete={handler}>
 *   <div className="barra-de-tarefa-existente">...</div>
 * </GanttTaskBarWrapper>
 */

import React, { useRef, useCallback, useEffect } from 'react'
import { TaskAnchor } from './TaskAnchor'
import { AnchorType } from '../hooks/usePredecessorEditing'
import { usePredecessorDrag } from '../contexts/PredecessorDragContext'

interface GanttTaskBarWrapperProps {
  taskId: string
  taskName: string  // Nome da tarefa para exibir no menu flutuante
  children: React.ReactNode
  editingMode: boolean
  barStyle?: React.CSSProperties  // Estilo da barra (left, width, top) para posicionar o wrapper
  onConnectionComplete?: (
    sourceTaskId: string,
    sourceAnchor: AnchorType,
    targetTaskId: string,
    targetAnchor: AnchorType
  ) => void
  // Callback para obter informações de outras tarefas
  getTaskInfo?: (taskId: string) => { name: string } | null
}

/**
 * Componente wrapper que adiciona funcionalidade de edição de predecessores
 * às barras de tarefa existentes sem modificar o código original do Gantt
 */
export function GanttTaskBarWrapper({
  taskId,
  taskName,
  children,
  editingMode,
  barStyle,
  onConnectionComplete,
  getTaskInfo
}: GanttTaskBarWrapperProps) {
  const { dragState, startDrag, updateMousePosition, setSnappedTarget, endDrag } = usePredecessorDrag()
  const containerRef = useRef<HTMLDivElement>(null)

  // Verifica se ESTA tarefa está sendo arrastada
  const isDraggingThisTask = dragState.isDragging && dragState.sourceTaskId === taskId

  // Handler quando começa a arrastar de uma âncora
  const handleAnchorMouseDown = useCallback((
    anchorTaskId: string,
    anchor: AnchorType,
    event: React.MouseEvent
  ) => {
    event.stopPropagation()
    event.preventDefault()  // Prevenir seleção de texto

    // Capturar posição inicial da âncora
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const anchorX = anchor === 'start' ? rect.left : rect.right
      const anchorY = rect.top + rect.height / 2
      startDrag(taskId, taskName, anchor, { x: anchorX, y: anchorY })
    }
  }, [taskId, taskName, startDrag])

  // Handler quando mouse entra em uma âncora durante drag
  const handleAnchorEnter = useCallback((targetTaskId: string, targetAnchor: AnchorType) => {
    if (dragState.isDragging) {
      setSnappedTarget({ taskId: targetTaskId, taskName, anchor: targetAnchor })
    }
  }, [dragState.isDragging, taskName, setSnappedTarget])

  // Handler quando mouse sai de uma âncora durante drag
  const handleAnchorLeave = useCallback(() => {
    if (dragState.isDragging) {
      setSnappedTarget(null)
    }
  }, [dragState.isDragging, setSnappedTarget])

  // Handler quando solta em uma âncora
  const handleAnchorMouseUp = useCallback((
    targetTaskId: string,
    targetAnchor: AnchorType
  ) => {
    if (dragState.isDragging && dragState.sourceTaskId && dragState.sourceAnchor && onConnectionComplete) {
      // Guardar valores antes de resetar
      const sourceTaskId = dragState.sourceTaskId
      const sourceAnchor = dragState.sourceAnchor

      // Reset estado ANTES de chamar callback
      endDrag()

      // Criar conexão
      onConnectionComplete(sourceTaskId, sourceAnchor, targetTaskId, targetAnchor)
    } else {
      // Reset estado mesmo se não houver callback
      endDrag()
    }
  }, [dragState, endDrag, onConnectionComplete])

  // Listener global para rastrear mouse durante drag (apenas se ESTA tarefa está sendo arrastada)
  useEffect(() => {
    if (!isDraggingThisTask) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      updateMousePosition({ x: e.clientX, y: e.clientY })
    }

    const handleMouseUp = () => {
      // Usar setTimeout para dar chance das âncoras processarem o mouseUp primeiro
      setTimeout(() => {
        endDrag()
      }, 10)
    }

    // Desabilitar seleção de texto durante drag
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'crosshair'

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      // Restaurar comportamento normal
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingThisTask, updateMousePosition, endDrag])

  return (
    <div
      ref={containerRef}
      className="absolute pointer-events-none"
      style={barStyle}
    >
      {/* Conteúdo original da barra - resetar position para ficar relativo ao wrapper */}
      <div className="relative w-full h-full pointer-events-auto">
        {children}
      </div>

      {/* Âncoras (apenas quando em modo de edição) - absolutas relativas ao wrapper */}
      {editingMode && (
        <>
          {/* Âncora de INÍCIO (esquerda) */}
          <TaskAnchor
            taskId={taskId}
            type="start"
            position="left"
            isActive={true}
            isDragging={isDraggingThisTask && dragState.sourceAnchor === 'start'}
            isSnapped={dragState.snappedTarget?.taskId === taskId && dragState.snappedTarget?.anchor === 'start'}
            onMouseDown={handleAnchorMouseDown}
            onMouseUp={handleAnchorMouseUp}
            onMouseEnter={() => handleAnchorEnter(taskId, 'start')}
            onMouseLeave={handleAnchorLeave}
          />

          {/* Âncora de FIM (direita) */}
          <TaskAnchor
            taskId={taskId}
            type="end"
            position="right"
            isActive={true}
            isDragging={isDraggingThisTask && dragState.sourceAnchor === 'end'}
            isSnapped={dragState.snappedTarget?.taskId === taskId && dragState.snappedTarget?.anchor === 'end'}
            onMouseDown={handleAnchorMouseDown}
            onMouseUp={handleAnchorMouseUp}
            onMouseEnter={() => handleAnchorEnter(taskId, 'end')}
            onMouseLeave={handleAnchorLeave}
          />
        </>
      )}

      {/* Menu flutuante informativo durante drag - apenas renderizar UMA VEZ */}
      {isDraggingThisTask && dragState.isDragging && (
        <div
          className="fixed bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-lg shadow-2xl z-[75] pointer-events-none border-2 border-blue-400"
          style={{
            left: `${dragState.mousePosition.x + 20}px`,
            top: `${dragState.mousePosition.y - 40}px`,
          }}
        >
          <div className="text-xs font-semibold">
            {dragState.snappedTarget ? (
              <>
                <div className="text-blue-100 mb-1">Conectando:</div>
                <div className="flex items-center gap-2">
                  <span className={dragState.sourceAnchor === 'start' ? 'text-green-300' : 'text-blue-300'}>
                    {dragState.sourceAnchor === 'start' ? '🟢 INÍCIO' : '🔵 FIM'}
                  </span>
                  <span>de</span>
                  <span className="font-bold text-yellow-200">{dragState.sourceTaskName}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span>→ ao</span>
                  <span className={dragState.snappedTarget.anchor === 'start' ? 'text-green-300' : 'text-blue-300'}>
                    {dragState.snappedTarget.anchor === 'start' ? '🟢 INÍCIO' : '🔵 FIM'}
                  </span>
                  <span>de</span>
                  <span className="font-bold text-yellow-200">
                    {dragState.snappedTarget.taskName}
                  </span>
                </div>
                <div className="text-center mt-2 text-green-300 font-bold text-xs animate-pulse">
                  ✓ Solte para confirmar
                </div>
              </>
            ) : (
              <>
                <div className="text-blue-100">Arrastando de:</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={dragState.sourceAnchor === 'start' ? 'text-green-300' : 'text-blue-300'}>
                    {dragState.sourceAnchor === 'start' ? '🟢 INÍCIO' : '🔵 FIM'}
                  </span>
                  <span>de</span>
                  <span className="font-bold text-yellow-200">{dragState.sourceTaskName}</span>
                </div>
                <div className="text-gray-200 text-[10px] mt-1">
                  Arraste até uma âncora de destino
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Linha de preview durante drag - apenas renderizar UMA VEZ */}
      {isDraggingThisTask && dragState.isDragging && (
        <svg
          className="fixed inset-0 pointer-events-none z-[60]"
          style={{ width: '100%', height: '100%' }}
        >
          <line
            x1={dragState.anchorPosition.x}
            y1={dragState.anchorPosition.y}
            x2={dragState.mousePosition.x}
            y2={dragState.mousePosition.y}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="5,5"
            strokeLinecap="round"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="10"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </line>
          <circle
            cx={dragState.mousePosition.x}
            cy={dragState.mousePosition.y}
            r="6"
            fill="#3b82f6"
            opacity="0.6"
          />
        </svg>
      )}
    </div>
  )
}
