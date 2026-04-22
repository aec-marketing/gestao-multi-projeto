import { useState, useMemo, useCallback } from 'react'
import { Task } from '@/types/database.types'

type SortBy = 'wbs' | 'name' | 'type' | 'duration' | 'progress'
type SortOrder = 'asc' | 'desc'

// Compara dois WBS codes numericamente (ex: "1.2.10" > "1.2.9")
function compareWbs(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Hook para gerenciar filtros e ordenação da tabela
 *
 * Mantém estado de busca, ordenação, e fornece função memoizada
 * para aplicar filtros e sorting
 */
export function useTableFilters() {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('wbs')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  /**
   * Alterna a ordem de classificação (asc <-> desc)
   */
  const toggleSortOrder = useCallback(() => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }, [])

  /**
   * Aplica filtro e ordenação em uma lista de tasks
   * Função memoizada para evitar recálculos desnecessários
   */
  const filterAndSort = useCallback((tasks: Task[]) => {
    let result = [...tasks]

    // Filtrar por termo de busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(task =>
        task.name.toLowerCase().includes(term) ||
        task.type.toLowerCase().includes(term)
      )
    }

    // Ordenar
    result.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'wbs':
          comparison = compareWbs(a.wbs_code, b.wbs_code)
          break
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0)
          break
        case 'progress':
          comparison = a.progress - b.progress
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [searchTerm, sortBy, sortOrder])

  return {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    toggleSortOrder,
    filterAndSort
  }
}
