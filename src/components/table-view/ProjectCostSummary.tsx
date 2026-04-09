/**
 * Card de resumo de custos do projeto
 * Mostra: custo das tarefas + despesas avulsas + gasto previsto editável + margem
 */

'use client'

import React, { useState } from 'react'
import { formatCurrency } from '@/utils/cost.utils'
import { supabase } from '@/lib/supabase'
import { dispatchToast } from '@/components/ui/ToastProvider'

interface ProjectCostSummaryProps {
  projectId: string
  budget: number | null          // Gasto Previsto estimado do projeto
  totalTaskCost: number          // Soma de estimated_cost das tarefas
  totalExpenses: number          // Soma das despesas avulsas
  onBudgetSaved: () => void      // Callback para invalidar cache após salvar
}

export function ProjectCostSummary({
  projectId,
  budget,
  totalTaskCost,
  totalExpenses,
  onBudgetSaved
}: ProjectCostSummaryProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [budgetInput, setBudgetInput] = useState(budget?.toString() || '')
  const [isSaving, setIsSaving] = useState(false)

  const totalCost = totalTaskCost + totalExpenses
  const budgetNum = budget ?? 0
  const remaining = budgetNum - totalCost
  const percentUsed = budgetNum > 0 ? Math.min((totalCost / budgetNum) * 100, 100) : 0

  const handleSaveBudget = async () => {
    setIsSaving(true)
    const value = parseFloat(budgetInput) || 0
    const { error } = await supabase
      .from('projects')
      .update({ budget: value })
      .eq('id', projectId)

    setIsSaving(false)
    if (error) {
      dispatchToast('Erro ao salvar gasto previsto', 'error')
    } else {
      dispatchToast('Gasto Previsto salvo', 'success')
      setIsEditing(false)
      onBudgetSaved()
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-semibold text-gray-700">💰 Resumo de Custos</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Custo das tarefas */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Custo das Tarefas</p>
          <p className="text-lg font-bold text-gray-800">{formatCurrency(totalTaskCost)}</p>
        </div>

        {/* Despesas avulsas */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Despesas Avulsas</p>
          <p className="text-lg font-bold text-gray-800">{formatCurrency(totalExpenses)}</p>
        </div>

        {/* Total gasto */}
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Total Gasto</p>
          <p className="text-lg font-bold text-blue-800">{formatCurrency(totalCost)}</p>
        </div>

        {/* Gasto Previsto editável */}
        <div className={`rounded-lg p-3 ${budgetNum > 0 ? (remaining < 0 ? 'bg-red-50' : 'bg-green-50') : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className={`text-xs uppercase tracking-wide ${budgetNum > 0 ? (remaining < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-500'}`}>
              Gasto Previsto
            </p>
            {!isEditing && (
              <button
                onClick={() => { setIsEditing(true); setBudgetInput(budget?.toString() || '') }}
                className="text-[10px] text-gray-400 hover:text-gray-600 underline"
              >
                editar
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-1.5">
              <input
                type="number"
                step="0.01"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBudget()}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleSaveBudget}
                  disabled={isSaving}
                  className="flex-1 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? '...' : 'Salvar'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-0.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className={`text-lg font-bold ${budgetNum > 0 ? (remaining < 0 ? 'text-red-700' : 'text-green-700') : 'text-gray-400 italic text-sm'}`}>
                {budgetNum > 0 ? formatCurrency(budgetNum) : 'Não definido'}
              </p>
              {budgetNum > 0 && (
                <p className={`text-xs mt-0.5 ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {remaining < 0 ? `${formatCurrency(Math.abs(remaining))} acima` : `${formatCurrency(remaining)} disponível`}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Barra de progresso do gasto previsto */}
      {budgetNum > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Gasto Previsto utilizado</span>
            <span className="font-medium">{((totalCost / budgetNum) * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${
                totalCost > budgetNum ? 'bg-red-500' :
                totalCost > budgetNum * 0.9 ? 'bg-orange-500' :
                'bg-green-500'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
