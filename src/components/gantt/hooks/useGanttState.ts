/**
 * Hook de estado consolidado do Gantt
 * Centraliza todos os 15+ estados que estavam dispersos no GanttViewTab
 */

import { useState, useCallback } from 'react'
import { Task } from '@/types/database.types'
import { GanttState, ResizeState } from '../types/gantt.types'

const initialState: GanttState = {
  selection: { selectedTask: null, selectedDay: null },
  dragDrop: { draggedTask: null, dragOverTask: null },
  modals: {
    allocationTask: null,
    subtaskTask: null,
    editingCostsTask: null,
    showRecalculate: false,
    showCycleAudit: false,
    pendingUpdates: []
  },
  view: { expandedTasks: new Set(), zoomLevel: 'week', sortOrder: 'structural' },
  filters: { type: 'all', person: 'all', progress: 'all' },
  resize: { resizingTask: null, tempDurations: new Map(), tempStartOffsets: new Map() },
  data: { predecessors: [], tasksInCycle: new Set() }
}

export function useGanttState() {
  const [state, setState] = useState<GanttState>(initialState)

  const actions = {
    // ========== SELECTION ==========
    selectTask: useCallback((taskId: string | null) => {
      setState(prev => ({ ...prev, selection: { ...prev.selection, selectedTask: taskId } }))
    }, []),

    selectDay: useCallback((day: string | null) => {
      setState(prev => ({ ...prev, selection: { ...prev.selection, selectedDay: day } }))
    }, []),

    // ========== VIEW ==========
    toggleExpand: useCallback((taskId: string) => {
      setState(prev => {
        const newExpanded = new Set(prev.view.expandedTasks)
        if (newExpanded.has(taskId)) {
          newExpanded.delete(taskId)
        } else {
          newExpanded.add(taskId)
        }
        return { ...prev, view: { ...prev.view, expandedTasks: newExpanded } }
      })
    }, []),

    expandMultiple: useCallback((taskIds: string[]) => {
      setState(prev => {
        const newExpanded = new Set(prev.view.expandedTasks)
        taskIds.forEach(id => newExpanded.add(id))
        return { ...prev, view: { ...prev.view, expandedTasks: newExpanded } }
      })
    }, []),

    setZoomLevel: useCallback((level: 'day' | 'week' | 'month') => {
      setState(prev => ({ ...prev, view: { ...prev.view, zoomLevel: level } }))
    }, []),

    setSortOrder: useCallback((order: 'structural' | 'chronological') => {
      setState(prev => ({ ...prev, view: { ...prev.view, sortOrder: order } }))
    }, []),

    // ========== FILTERS ==========
    setFilter: useCallback((key: keyof GanttState['filters'], value: string) => {
      setState(prev => ({ ...prev, filters: { ...prev.filters, [key]: value } }))
    }, []),

    // ========== DRAG & DROP ==========
    setDraggedTask: useCallback((taskId: string | null) => {
      setState(prev => ({ ...prev, dragDrop: { ...prev.dragDrop, draggedTask: taskId } }))
    }, []),

    setDragOverTask: useCallback((taskId: string | null) => {
      setState(prev => ({ ...prev, dragDrop: { ...prev.dragDrop, dragOverTask: taskId } }))
    }, []),

    // ========== RESIZE ==========
    setResizingTask: useCallback((resize: ResizeState | null) => {
      setState(prev => ({ ...prev, resize: { ...prev.resize, resizingTask: resize } }))
    }, []),

    setTempDuration: useCallback((taskId: string, duration: number | undefined) => {
      setState(prev => {
        const newMap = new Map(prev.resize.tempDurations)
        if (duration === undefined) {
          newMap.delete(taskId)
        } else {
          newMap.set(taskId, duration)
        }
        return { ...prev, resize: { ...prev.resize, tempDurations: newMap } }
      })
    }, []),

    setTempStartOffset: useCallback((taskId: string, offset: number | undefined) => {
      setState(prev => {
        const newMap = new Map(prev.resize.tempStartOffsets)
        if (offset === undefined) {
          newMap.delete(taskId)
        } else {
          newMap.set(taskId, offset)
        }
        return { ...prev, resize: { ...prev.resize, tempStartOffsets: newMap } }
      })
    }, []),

    clearResize: useCallback(() => {
      setState(prev => ({
        ...prev,
        resize: {
          resizingTask: null,
          tempDurations: new Map(),
          tempStartOffsets: new Map()
        }
      }))
    }, []),

    // ========== MODALS ==========
    openModal: useCallback((modal: keyof GanttState['modals'], data?: any) => {
      setState(prev => ({ ...prev, modals: { ...prev.modals, [modal]: data ?? true } }))
    }, []),

    closeModal: useCallback((modal: keyof GanttState['modals']) => {
      setState(prev => ({
        ...prev,
        modals: {
          ...prev.modals,
          [modal]: modal.startsWith('show') ? false : null
        }
      }))
    }, []),

    setPendingUpdates: useCallback((updates: any[]) => {
      setState(prev => ({ ...prev, modals: { ...prev.modals, pendingUpdates: updates } }))
    }, []),

    // ========== DATA ==========
    setPredecessors: useCallback((predecessors: any[]) => {
      setState(prev => ({ ...prev, data: { ...prev.data, predecessors } }))
    }, []),

    setTasksInCycle: useCallback((taskIds: Set<string>) => {
      setState(prev => ({ ...prev, data: { ...prev.data, tasksInCycle: taskIds } }))
    }, [])
  }

  return { state, actions }
}
