/**
 * Célula para exibir o custo de uma tarefa na tabela
 * Exibe o campo estimated_cost (renomeado para "Custo" na UI)
 */

import React from 'react'
import { formatCurrency } from '@/utils/cost.utils'

interface TaskCostCellProps {
  cost: number             // estimated_cost da tarefa
  isReadOnly?: boolean     // Tarefa pai: soma das subtarefas
  hasPendingChange?: boolean
}

export function TaskCostCell({
  cost,
  isReadOnly = false,
  hasPendingChange = false
}: TaskCostCellProps) {
  const baseClasses = `
    px-2 py-1 rounded text-sm transition-all text-center
    ${hasPendingChange
      ? 'bg-yellow-50 border-2 border-yellow-400 ring-1 ring-yellow-300'
      : 'border border-transparent'
    }
  `.trim()

  if (isReadOnly) {
    return (
      <div
        className={`${baseClasses} bg-gray-50 cursor-default text-gray-600 italic`}
        title="Soma dos custos das subtarefas"
      >
        <div className="text-xs font-medium">{formatCurrency(cost)}</div>
        <span className="text-xs text-gray-400">∑</span>
      </div>
    )
  }

  if (cost === 0) {
    return (
      <div className={`${baseClasses} text-gray-400`} title="Sem custo definido">
        <div className="text-xs">-</div>
      </div>
    )
  }

  return (
    <div className={`${baseClasses} bg-blue-50 text-blue-800`}>
      <div className="text-xs font-semibold">{formatCurrency(cost)}</div>
    </div>
  )
}

/**
 * Componente de display simples (sem edição)
 */
export function TaskCostDisplay({
  cost,
  format = 'full'
}: {
  cost: number
  format?: 'full' | 'compact'
}) {
  if (cost === 0) {
    return <span className="text-gray-400 text-xs">-</span>
  }

  if (format === 'compact') {
    const formatted = cost >= 1000
      ? `R$ ${(cost / 1000).toFixed(1)}k`
      : formatCurrency(cost)
    return <span className="text-gray-700 text-xs font-mono">{formatted}</span>
  }

  return <span className="text-gray-700 text-sm font-mono">{formatCurrency(cost)}</span>
}
