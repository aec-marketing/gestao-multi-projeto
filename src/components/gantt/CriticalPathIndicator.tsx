/**
 * Componente para mostrar informações do caminho crítico no Gantt
 */

'use client'

import React from 'react'
import { CPMResult } from '@/utils/criticalPath'

interface CriticalPathIndicatorProps {
  cpmResult: CPMResult | null
  isCalculating: boolean
  lastCalculated: Date | null
  onRecalculate: () => void
}

export function CriticalPathIndicator({
  cpmResult,
  isCalculating,
  lastCalculated,
  onRecalculate
}: CriticalPathIndicatorProps) {
  if (!cpmResult) return null

  const criticalTaskCount = cpmResult.criticalPath.length
  const totalTasks = cpmResult.tasks.size
  const criticalPercentage = totalTasks > 0 ? Math.round((criticalTaskCount / totalTasks) * 100) : 0

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center justify-between">
        {/* Info do Caminho Crítico */}
        <div className="flex items-center gap-4">
          {/* Ícone */}
          <div className="flex-shrink-0">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          {/* Estatísticas */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-red-900">Caminho Crítico</h3>
              {isCalculating && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  Calculando...
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-1 text-sm text-red-700">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="font-semibold">{criticalTaskCount}</span>
                <span>de {totalTasks} tarefas</span>
              </div>

              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="font-semibold">{criticalPercentage}%</span>
                <span>do projeto</span>
              </div>

              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">{cpmResult.projectDuration}</span>
                <span>dias de duração</span>
              </div>
            </div>

            {lastCalculated && (
              <div className="text-xs text-red-600 mt-1">
                Último cálculo: {lastCalculated.toLocaleTimeString('pt-BR')}
              </div>
            )}
          </div>
        </div>

        {/* Botão de Recalcular */}
        <button
          onClick={onRecalculate}
          disabled={isCalculating}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm font-medium text-red-700">Recalcular</span>
        </button>
      </div>

      {/* Legenda */}
      <div className="mt-3 pt-3 border-t border-red-200">
        <div className="flex items-center gap-6 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span>Tarefas críticas (slack = 0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span>Tarefas não críticas (com folga)</span>
          </div>
          <div className="text-red-600 italic">
            💡 Atrasos em tarefas críticas impactam diretamente o prazo final do projeto
          </div>
        </div>
      </div>
    </div>
  )
}
