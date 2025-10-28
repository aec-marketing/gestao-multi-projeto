'use client'

import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'

interface FinancialViewTabProps {
  project: Project
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  onRefresh: () => void
}

export default function FinancialViewTab({
  project,
  tasks,
  resources,
  allocations,
  onRefresh
}: FinancialViewTabProps) {
  
  // Calcular totais
  const totalEstimated = tasks.reduce((sum, task) => sum + (task.estimated_cost || 0), 0)
  const totalActual = tasks.reduce((sum, task) => sum + (task.actual_cost || 0), 0)
  const difference = totalEstimated - totalActual
  const percentExecuted = totalEstimated > 0 ? (totalActual / totalEstimated) * 100 : 0

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
  }

  // Calcular custos por tipo de tarefa (apenas tarefas principais)
  const costsByType = tasks
    .filter(t => !t.parent_id) // Apenas principais
    .reduce((acc, task) => {
      const type = task.type
      const cost = task.actual_cost || task.estimated_cost || 0
      
      if (!acc[type]) {
        acc[type] = { estimated: 0, actual: 0 }
      }
      
      acc[type].estimated += task.estimated_cost || 0
      acc[type].actual += task.actual_cost || 0
      
      return acc
    }, {} as Record<string, { estimated: number; actual: number }>)

  // Top 5 tarefas mais caras
  const topTasks = [...tasks]
    .filter(t => !t.parent_id) // Apenas principais
    .sort((a, b) => (b.actual_cost || b.estimated_cost || 0) - (a.actual_cost || a.estimated_cost || 0))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Dashboard Financeiro</h2>
        <p className="text-sm text-gray-600">
          Visão consolidada dos custos do projeto
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Custo Estimado Total */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Custo Estimado</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(totalEstimated)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        {/* Custo Real Total */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Custo Real</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(totalActual)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>

        {/* Diferença */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">
                {difference >= 0 ? 'Economia' : 'Estouro'}
              </p>
              <p className={`text-2xl font-bold ${difference >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(Math.abs(difference))}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              difference >= 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <span className="text-2xl">{difference >= 0 ? '✅' : '⚠️'}</span>
            </div>
          </div>
        </div>

        {/* % Executado */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">% Executado</p>
              <p className="text-2xl font-bold text-purple-700">
                {percentExecuted.toFixed(1)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📈</span>
            </div>
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(percentExecuted, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Custos por Tipo */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          💼 Custos por Tipo de Tarefa
        </h3>
        
        <div className="space-y-3">
          {Object.entries(costsByType).map(([type, costs]) => {
            const total = costs.actual || costs.estimated
            const percentage = totalActual > 0 ? (costs.actual / totalActual) * 100 : 0
            
            return (
              <div key={type} className="border-b pb-3 last:border-b-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatCurrency(total)}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                  <span>Est: {formatCurrency(costs.estimated)}</span>
                  <span>Real: {formatCurrency(costs.actual)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top 5 Tarefas Mais Caras */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🏆 Top 5 Tarefas Mais Caras
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tarefa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Estimado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Real</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topTasks.map((task, index) => {
                const diff = (task.estimated_cost || 0) - (task.actual_cost || 0)
                return (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{task.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {task.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-700">
                      {formatCurrency(task.estimated_cost || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-blue-700">
                      {formatCurrency(task.actual_cost || 0)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      diff >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}