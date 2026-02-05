/**
 * Hook para modo de edição de predecessores com âncoras visuais
 * ONDA 5.7: Drag & drop visual para criar predecessores
 */

import { useState, useCallback } from 'react'

export type AnchorType = 'start' | 'end'

export interface PredecessorDragState {
  isActive: boolean
  sourceTaskId: string | null
  sourceAnchor: AnchorType | null
  mouseX: number
  mouseY: number
}

export interface PredecessorConnection {
  sourceTaskId: string
  sourceAnchor: AnchorType
  targetTaskId: string
  targetAnchor: AnchorType
}

/**
 * Converte conexão de âncoras para tipo de predecessor do banco
 *
 * Regras:
 * - Start → Start (SS): Tarefa começa junto com o começo de outra
 * - Start → End (SF): Tarefa começa quando outra termina (raro, geralmente é FS invertido)
 * - End → Start (FS): Tarefa termina antes de outra começar (PADRÃO)
 * - End → End (FF): Tarefa termina junto com o término de outra
 */
function getRelationType(
  sourceAnchor: AnchorType,
  targetAnchor: AnchorType
): 'fim_inicio' | 'inicio_inicio' | 'fim_fim' | 'inicio_fim' {
  if (sourceAnchor === 'end' && targetAnchor === 'start') {
    return 'fim_inicio' // FS - predecessor termina → sucessor começa
  }
  if (sourceAnchor === 'start' && targetAnchor === 'start') {
    return 'inicio_inicio' // SS - ambas começam juntas
  }
  if (sourceAnchor === 'end' && targetAnchor === 'end') {
    return 'fim_fim' // FF - ambas terminam juntas
  }
  if (sourceAnchor === 'start' && targetAnchor === 'end') {
    return 'inicio_fim' // SF - predecessor começa → sucessor termina (raro)
  }

  // Fallback para FS (mais comum)
  return 'fim_inicio'
}

export function usePredecessorEditing() {
  const [editingMode, setEditingMode] = useState(false)
  const [dragState, setDragState] = useState<PredecessorDragState>({
    isActive: false,
    sourceTaskId: null,
    sourceAnchor: null,
    mouseX: 0,
    mouseY: 0
  })

  /**
   * Ativa/desativa o modo de edição de predecessores
   */
  const toggleEditingMode = useCallback(() => {
    setEditingMode(prev => !prev)
    // Reset drag state quando sair do modo
    if (editingMode) {
      setDragState({
        isActive: false,
        sourceTaskId: null,
        sourceAnchor: null,
        mouseX: 0,
        mouseY: 0
      })
    }
  }, [editingMode])

  /**
   * Inicia o drag de uma âncora
   */
  const startDrag = useCallback((taskId: string, anchor: AnchorType, mouseX: number, mouseY: number) => {
    setDragState({
      isActive: true,
      sourceTaskId: taskId,
      sourceAnchor: anchor,
      mouseX,
      mouseY
    })
  }, [])

  /**
   * Atualiza posição do mouse durante o drag
   */
  const updateDragPosition = useCallback((mouseX: number, mouseY: number) => {
    setDragState(prev => ({
      ...prev,
      mouseX,
      mouseY
    }))
  }, [])

  /**
   * Finaliza o drag e retorna a conexão se válida
   */
  const endDrag = useCallback((
    targetTaskId: string | null,
    targetAnchor: AnchorType | null
  ): PredecessorConnection | null => {
    if (!dragState.sourceTaskId || !dragState.sourceAnchor || !targetTaskId || !targetAnchor) {
      // Drag cancelado ou inválido
      setDragState({
        isActive: false,
        sourceTaskId: null,
        sourceAnchor: null,
        mouseX: 0,
        mouseY: 0
      })
      return null
    }

    // Validar: não pode conectar tarefa a si mesma
    if (dragState.sourceTaskId === targetTaskId) {
      setDragState({
        isActive: false,
        sourceTaskId: null,
        sourceAnchor: null,
        mouseX: 0,
        mouseY: 0
      })
      return null
    }

    // Criar conexão válida
    const connection: PredecessorConnection = {
      sourceTaskId: dragState.sourceTaskId,
      sourceAnchor: dragState.sourceAnchor,
      targetTaskId,
      targetAnchor
    }

    // Reset drag state
    setDragState({
      isActive: false,
      sourceTaskId: null,
      sourceAnchor: null,
      mouseX: 0,
      mouseY: 0
    })

    return connection
  }, [dragState])

  /**
   * Cancela o drag atual
   */
  const cancelDrag = useCallback(() => {
    setDragState({
      isActive: false,
      sourceTaskId: null,
      sourceAnchor: null,
      mouseX: 0,
      mouseY: 0
    })
  }, [])

  return {
    editingMode,
    dragState,
    toggleEditingMode,
    startDrag,
    updateDragPosition,
    endDrag,
    cancelDrag,
    getRelationType
  }
}
