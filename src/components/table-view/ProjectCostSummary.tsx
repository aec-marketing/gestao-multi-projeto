/**
 * Card de resumo de custos do projeto
 *
 * ONDA 1: Mostra totais de custos estimado vs real
 * Comparação visual com indicadores de status
 */

import React from 'react'
import { formatCurrency, compareCosts } from '@/utils/cost.utils'

interface ProjectCostSummaryProps {
  totalEstimatedCost: number
  totalActualCost: number
}

export function ProjectCostSummary({
  totalEstimatedCost,
  totalActualCost
}: ProjectCostSummaryProps) {
  // Comparação
  const comparison = totalEstimatedCost > 0
    ? compareCosts(totalEstimatedCost, totalActualCost)
    : null

  // Se não tem custos definidos
  if (totalEstimatedCost === 0 && totalActualCost === 0) {
    return null // Não exibe card se não há custos
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Título */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-700">
            💰 Resumo de Custos
          </span>
        </div>

        {/* Custos */}
        <div className="flex items-center gap-6">
          {/* Custo Estimado */}
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Estimado
            </div>
            <div className="text-lg font-semibold text-gray-700">
              {formatCurrency(totalEstimatedCost)}
            </div>
          </div>

          {/* Seta */}
          <div className="text-gray-400">
            →
          </div>

          {/* Custo Real */}
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Real
            </div>
            <div className={`text-lg font-bold ${
              !comparison
                ? 'text-gray-700'
                : comparison.status === 'overbudget'
                ? 'text-red-600'
                : comparison.status === 'warning'
                ? 'text-orange-600'
                : 'text-green-600'
            }`}>
              {formatCurrency(totalActualCost)}
            </div>
          </div>

          {/* Badge de diferença */}
          {comparison && comparison.difference !== 0 && (
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
              comparison.status === 'overbudget'
                ? 'bg-red-100 text-red-700 border border-red-300'
                : comparison.status === 'warning'
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : comparison.difference > 0
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-green-100 text-green-700 border border-green-300'
            }`}>
              {comparison.difference > 0 ? '+' : ''}
              {comparison.percentageDiff.toFixed(1)}%
            </div>
          )}

          {/* Status Badge */}
          {comparison && (
            <div className="ml-2">
              {comparison.status === 'overbudget' && (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded border border-red-200">
                  <span>⚠️</span>
                  <span>Acima do Orçamento</span>
                </div>
              )}
              {comparison.status === 'warning' && (
                <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded border border-orange-200">
                  <span>⚠️</span>
                  <span>Próximo ao Limite</span>
                </div>
              )}
              {comparison.status === 'ok' && comparison.difference <= 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded border border-green-200">
                  <span>✓</span>
                  <span>Dentro do Orçamento</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Barra de progresso visual */}
      {comparison && totalEstimatedCost > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${
                  comparison.status === 'overbudget'
                    ? 'bg-red-600'
                    : comparison.status === 'warning'
                    ? 'bg-orange-500'
                    : 'bg-green-500'
                }`}
                style={{
                  width: `${Math.min((totalActualCost / totalEstimatedCost) * 100, 100)}%`
                }}
              />
            </div>
            <span className="text-xs text-gray-600 font-mono w-12 text-right">
              {totalEstimatedCost > 0
                ? `${Math.round((totalActualCost / totalEstimatedCost) * 100)}%`
                : '0%'
              }
            </span>
          </div>
        </div>
      )}

      {/* Detalhes adicionais (tooltip info) */}
      {comparison && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              Diferença: {comparison.difference > 0 ? '+' : ''}{formatCurrency(comparison.difference)}
            </span>
            <span className="text-gray-500">
              {totalActualCost === 0
                ? 'Nenhum recurso alocado'
                : 'Baseado em recursos alocados'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
