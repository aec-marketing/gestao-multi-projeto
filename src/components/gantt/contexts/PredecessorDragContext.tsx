/**
 * Contexto global para gerenciar estado de drag de predecessores
 * ONDA 5.7: Permite que todos os wrappers compartilhem informação sobre o drag atual
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AnchorType } from '../hooks/usePredecessorEditing'

interface DragState {
  isDragging: boolean
  sourceTaskId: string | null
  sourceTaskName: string | null
  sourceAnchor: AnchorType | null
  mousePosition: { x: number; y: number }
  anchorPosition: { x: number; y: number }
  snappedTarget: { taskId: string; taskName: string; anchor: AnchorType } | null
}

interface PredecessorDragContextType {
  dragState: DragState
  startDrag: (taskId: string, taskName: string, anchor: AnchorType, anchorPos: { x: number; y: number }) => void
  updateMousePosition: (pos: { x: number; y: number }) => void
  setSnappedTarget: (target: { taskId: string; taskName: string; anchor: AnchorType } | null) => void
  endDrag: () => void
}

const PredecessorDragContext = createContext<PredecessorDragContextType | null>(null)

export function PredecessorDragProvider({ children }: { children: ReactNode }) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    sourceTaskId: null,
    sourceTaskName: null,
    sourceAnchor: null,
    mousePosition: { x: 0, y: 0 },
    anchorPosition: { x: 0, y: 0 },
    snappedTarget: null
  })

  const startDrag = useCallback((
    taskId: string,
    taskName: string,
    anchor: AnchorType,
    anchorPos: { x: number; y: number }
  ) => {
    setDragState({
      isDragging: true,
      sourceTaskId: taskId,
      sourceTaskName: taskName,
      sourceAnchor: anchor,
      mousePosition: anchorPos,
      anchorPosition: anchorPos,
      snappedTarget: null
    })
  }, [])

  const updateMousePosition = useCallback((pos: { x: number; y: number }) => {
    setDragState(prev => ({ ...prev, mousePosition: pos }))
  }, [])

  const setSnappedTarget = useCallback((target: { taskId: string; taskName: string; anchor: AnchorType } | null) => {
    setDragState(prev => ({ ...prev, snappedTarget: target }))
  }, [])

  const endDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      sourceTaskId: null,
      sourceTaskName: null,
      sourceAnchor: null,
      mousePosition: { x: 0, y: 0 },
      anchorPosition: { x: 0, y: 0 },
      snappedTarget: null
    })
  }, [])

  return (
    <PredecessorDragContext.Provider value={{ dragState, startDrag, updateMousePosition, setSnappedTarget, endDrag }}>
      {children}
    </PredecessorDragContext.Provider>
  )
}

export function usePredecessorDrag() {
  const context = useContext(PredecessorDragContext)
  if (!context) {
    throw new Error('usePredecessorDrag must be used within PredecessorDragProvider')
  }
  return context
}
