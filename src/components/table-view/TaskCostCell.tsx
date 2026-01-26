/**
 * Célula para exibir custo de uma tarefa na tabela
 *
 * ONDA 1: Mostra custo real baseado em recursos alocados
 * ONDA 1.5: Comparação com custo estimado
 */

import React from 'react'
import { formatCurrency, compareCosts } from '@/utils/cost.utils'

interface TaskCostCellProps {
  actualCost: number       // Custo real (baseado em recursos alocados)
  estimatedCost: number    // Custo estimado
  isReadOnly?: boolean     // Se é tarefa pai (soma das subtarefas)
  hasPendingChange?: boolean  // Se tem mudança pendente
}

export function TaskCostCell({
  actualCost,
  estimatedCost,
  isReadOnly = false,
  hasPendingChange = false
}: TaskCostCellProps) {
  // Comparação de custos
  const comparison = estimatedCost > 0
    ? compareCosts(estimatedCost, actualCost)
    : null

  // Classes base
  const baseClasses = `
    px-2 py-1 rounded text-sm transition-all text-center
    ${hasPendingChange
      ? 'bg-yellow-50 border-2 border-yellow-400 ring-1 ring-yellow-300'
      : 'border border-transparent'
    }
  `.trim()

  // Se tarefa pai (readonly)
  if (isReadOnly) {
    return (
      <div
        className={`${baseClasses} bg-gray-50 cursor-default text-gray-600 italic`}
        title="Custo calculado automaticamente pela soma das subtarefas"
      >
        <div className="text-xs font-medium">{formatCurrency(actualCost)}</div>
        <span className="text-xs text-gray-400">∑</span>
      </div>
    )
  }

  // Se não tem custo
  if (actualCost === 0 && estimatedCost === 0) {
    return (
      <div
        className={`${baseClasses} text-gray-400`}
        title="Sem custos definidos"
      >
        <div className="text-xs">-</div>
      </div>
    )
  }

  // Se só tem custo estimado (sem recursos alocados)
  if (actualCost === 0 && estimatedCost > 0) {
    return (
      <div
        className={`${baseClasses} bg-blue-50 text-blue-700`}
        title={`Custo estimado: ${formatCurrency(estimatedCost)}\nNenhum recurso alocado ainda`}
      >
        <div className="text-xs font-medium">{formatCurrency(estimatedCost)}</div>
        <div className="text-[10px] text-blue-500">estimado</div>
      </div>
    )
  }

  // Se tem custo real (recursos alocados)
  return (
    <div className="relative group">
      <div
        className={`${baseClasses} ${
          comparison?.status === 'overbudget'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : comparison?.status === 'warning'
            ? 'bg-orange-50 text-orange-700 border border-orange-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}
      >
        <div className="text-xs font-semibold">{formatCurrency(actualCost)}</div>
        {comparison && (
          <div className={`text-[10px] ${
            comparison.difference > 0 ? 'text-red-600' :
            comparison.difference < 0 ? 'text-green-600' :
            'text-gray-600'
          }`}>
            {comparison.difference > 0 && '+'}
            {comparison.percentageDiff.toFixed(0)}%
          </div>
        )}
      </div>

      {/* Tooltip detalhado */}
      {comparison && (
        <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-4 py-3 left-1/2 transform -translate-x-1/2 bottom-full mb-2 z-[9999] shadow-2xl whitespace-nowrap pointer-events-none">
          <div className="space-y-1.5">
            <p className="font-semibold text-blue-300 border-b border-gray-700 pb-1">
              Análise de Custo
            </p>
            <div className="space-y-1">
              <p className="flex justify-between gap-4">
                <span className="text-gray-400">Estimado:</span>
                <span className="font-mono">{formatCurrency(comparison.estimated)}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-gray-400">Real:</span>
                <span className="font-mono font-semibold">{formatCurrency(comparison.actual)}</span>
              </p>
              <div className="border-t border-gray-700 pt-1 mt-1">
                <p className="flex justify-between gap-4">
                  <span className="text-gray-400">Diferença:</span>
                  <span className={`font-mono font-semibold ${
                    comparison.difference > 0 ? 'text-red-400' :
                    comparison.difference < 0 ? 'text-green-400' :
                    'text-gray-400'
                  }`}>
                    {comparison.difference > 0 ? '+' : ''}
                    {formatCurrency(comparison.difference)} ({comparison.percentageDiff > 0 ? '+' : ''}{comparison.percentageDiff.toFixed(1)}%)
                  </span>
                </p>
              </div>
            </div>
            {comparison.status === 'overbudget' && (
              <p className="text-red-400 text-[10px] mt-2 pt-1 border-t border-gray-700">
                ⚠️ Custo acima do orçamento!
              </p>
            )}
            {comparison.status === 'warning' && (
              <p className="text-orange-400 text-[10px] mt-2 pt-1 border-t border-gray-700">
                ⚠️ Atenção: próximo ao limite
              </p>
            )}
            {comparison.status === 'ok' && comparison.difference <= 0 && (
              <p className="text-green-400 text-[10px] mt-2 pt-1 border-t border-gray-700">
                ✓ Dentro do orçamento
              </p>
            )}
          </div>
          {/* Seta do tooltip */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1"></div>
        </div>
      )}
    </div>
  )
}

/**
 * Componente de display simples (sem edição)
 * Usado em readonly mode ou previews
 */
export function TaskCostDisplay({
  actualCost,
  format = 'full'
}: {
  actualCost: number
  format?: 'full' | 'compact'
}) {
  if (actualCost === 0) {
    return <span className="text-gray-400 text-xs">-</span>
  }

  if (format === 'compact') {
    // Formato compacto: R$ 1,2k
    const formatted = actualCost >= 1000
      ? `R$ ${(actualCost / 1000).toFixed(1)}k`
      : formatCurrency(actualCost)

    return <span className="text-gray-700 text-xs font-mono">{formatted}</span>
  }

  // Formato completo
  return <span className="text-gray-700 text-sm font-mono">{formatCurrency(actualCost)}</span>
}
