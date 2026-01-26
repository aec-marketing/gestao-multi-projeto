'use client'

import { useMemo } from 'react'
import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { calculateResourceCost } from '@/utils/cost.utils'

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

  // ONDA 3: Calcular custos por recurso
  const costsByResource = useMemo(() => {
    const resourceCosts = new Map<string, {
      name: string
      regularCost: number
      overtimeCost: number
      totalCost: number
      taskCount: number
      overtimeHours: number
    }>()

    allocations.forEach(alloc => {
      const resource = resources.find(r => r.id === alloc.resource_id)
      const task = tasks.find(t => t.id === alloc.task_id)

      if (!resource || !task) return

      const durationMinutes = task.duration_minutes || 0
      const allocatedMinutes = alloc.allocated_minutes ?? durationMinutes
      const overtimeMinutes = alloc.overtime_minutes || 0
      const overtimeMultiplier = (alloc as any).overtime_multiplier || 1.5

      // Custo regular
      const regularCost = (allocatedMinutes / 60) * resource.hourly_rate
      // Custo hora extra
      const overtimeCost = (overtimeMinutes / 60) * resource.hourly_rate * overtimeMultiplier

      const existing = resourceCosts.get(resource.id) || {
        name: resource.name,
        regularCost: 0,
        overtimeCost: 0,
        totalCost: 0,
        taskCount: 0,
        overtimeHours: 0
      }

      resourceCosts.set(resource.id, {
        name: resource.name,
        regularCost: existing.regularCost + regularCost,
        overtimeCost: existing.overtimeCost + overtimeCost,
        totalCost: existing.totalCost + regularCost + overtimeCost,
        taskCount: existing.taskCount + 1,
        overtimeHours: existing.overtimeHours + (overtimeMinutes / 60)
      })
    })

    return Array.from(resourceCosts.values())
      .sort((a, b) => b.totalCost - a.totalCost)
  }, [allocations, resources, tasks])

  // ONDA 3: Tarefas com hora extra
  const overtimeTasks = useMemo(() => {
    return tasks
      .filter(task => {
        const taskAllocations = allocations.filter(a => a.task_id === task.id)
        return taskAllocations.some(a => a.overtime_minutes && a.overtime_minutes > 0)
      })
      .map(task => {
        const taskAllocations = allocations.filter(a => a.task_id === task.id)
        const totalOvertimeMinutes = taskAllocations.reduce((sum, a) => sum + (a.overtime_minutes || 0), 0)
        const overtimeCost = taskAllocations.reduce((sum, alloc) => {
          const resource = resources.find(r => r.id === alloc.resource_id)
          if (!resource) return sum
          const overtimeMinutes = alloc.overtime_minutes || 0
          const overtimeMultiplier = (alloc as any).overtime_multiplier || 1.5
          return sum + (overtimeMinutes / 60) * resource.hourly_rate * overtimeMultiplier
        }, 0)

        return {
          task,
          overtimeHours: totalOvertimeMinutes / 60,
          overtimeCost,
          resourceCount: taskAllocations.length
        }
      })
      .sort((a, b) => b.overtimeCost - a.overtimeCost)
  }, [tasks, allocations, resources])

  // ONDA 3: Tarefas que estouraram orçamento
  const budgetAlerts = useMemo(() => {
    return tasks
      .filter(task => {
        const estimated = task.estimated_cost || 0
        const actual = task.actual_cost || 0
        return actual > estimated && estimated > 0
      })
      .map(task => {
        const estimated = task.estimated_cost || 0
        const actual = task.actual_cost || 0
        const overrun = actual - estimated
        const overrunPercent = (overrun / estimated) * 100

        return {
          task,
          estimated,
          actual,
          overrun,
          overrunPercent
        }
      })
      .sort((a, b) => b.overrunPercent - a.overrunPercent)
      .slice(0, 10) // Top 10
  }, [tasks])

  // ONDA 3: Total de hora extra
  const totalOvertimeCost = overtimeTasks.reduce((sum, t) => sum + t.overtimeCost, 0)
  const totalOvertimeHours = overtimeTasks.reduce((sum, t) => sum + t.overtimeHours, 0)

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

      {/* ONDA 3: Cards de Hora Extra e Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total de Hora Extra */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-red-900 font-medium mb-1">Custo de Hora Extra</p>
              <p className="text-2xl font-bold text-red-700">
                {formatCurrency(totalOvertimeCost)}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center">
              <span className="text-2xl">⏰</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-red-800">
            <span>{totalOvertimeHours.toFixed(1)}h de hora extra</span>
            <span>{overtimeTasks.length} tarefas</span>
          </div>
        </div>

        {/* Alertas de Orçamento */}
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-orange-900 font-medium mb-1">Tarefas Acima do Orçamento</p>
              <p className="text-2xl font-bold text-orange-700">
                {budgetAlerts.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
          <div className="text-sm text-orange-800">
            {budgetAlerts.length > 0 ? (
              <span>Estouro total: {formatCurrency(budgetAlerts.reduce((sum, a) => sum + a.overrun, 0))}</span>
            ) : (
              <span>✅ Todas as tarefas dentro do orçamento</span>
            )}
          </div>
        </div>
      </div>

      {/* ONDA 3: Custos por Recurso */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          👥 Custos por Recurso
        </h3>

        {costsByResource.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum recurso alocado ainda
          </div>
        ) : (
          <div className="space-y-3">
            {costsByResource.map((resourceCost) => {
              const overtimePercentage = resourceCost.totalCost > 0
                ? (resourceCost.overtimeCost / resourceCost.totalCost) * 100
                : 0

              return (
                <div key={resourceCost.name} className="border-b pb-3 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm">
                        {resourceCost.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">{resourceCost.name}</span>
                        <div className="text-xs text-gray-500">
                          {resourceCost.taskCount} tarefa{resourceCost.taskCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(resourceCost.totalCost)}
                      </p>
                      {resourceCost.overtimeHours > 0 && (
                        <p className="text-xs text-red-600">
                          +{resourceCost.overtimeHours.toFixed(1)}h extra
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Breakdown: Regular + Hora Extra */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Custo regular:</span>
                      <span>{formatCurrency(resourceCost.regularCost)}</span>
                    </div>
                    {resourceCost.overtimeCost > 0 && (
                      <div className="flex items-center justify-between text-xs text-red-600 font-medium">
                        <span>Hora extra:</span>
                        <span>+{formatCurrency(resourceCost.overtimeCost)} ({overtimePercentage.toFixed(1)}%)</span>
                      </div>
                    )}
                  </div>

                  {/* Barra de progresso */}
                  <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="h-full flex">
                      <div
                        className="bg-blue-600"
                        style={{
                          width: `${((resourceCost.regularCost / costsByResource[0].totalCost) * 100)}%`
                        }}
                      />
                      {resourceCost.overtimeCost > 0 && (
                        <div
                          className="bg-red-600"
                          style={{
                            width: `${((resourceCost.overtimeCost / costsByResource[0].totalCost) * 100)}%`
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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

      {/* ONDA 3: Tarefas com Hora Extra */}
      {overtimeTasks.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ⏰ Tarefas com Hora Extra
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tarefa</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Horas Extra</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Custo Extra</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Recursos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {overtimeTasks.slice(0, 10).map((item) => (
                  <tr key={item.task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.task.name}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-700 font-mono">
                      {item.overtimeHours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-700 font-bold">
                      {formatCurrency(item.overtimeCost)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {item.resourceCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-900 font-medium">Total de Hora Extra:</span>
              <div className="text-right">
                <p className="text-red-700 font-bold">{formatCurrency(totalOvertimeCost)}</p>
                <p className="text-xs text-red-600">{totalOvertimeHours.toFixed(1)} horas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONDA 3: Alertas de Orçamento Estourado */}
      {budgetAlerts.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ⚠️ Tarefas Acima do Orçamento
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-orange-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tarefa</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Estimado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Real</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Estouro</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">% Acima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {budgetAlerts.map((alert) => (
                  <tr key={alert.task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{alert.task.name}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-700">
                      {formatCurrency(alert.estimated)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-700 font-bold">
                      {formatCurrency(alert.actual)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-orange-700 font-bold">
                      {formatCurrency(alert.overrun)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                        alert.overrunPercent > 50
                          ? 'bg-red-100 text-red-700'
                          : alert.overrunPercent > 20
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        +{alert.overrunPercent.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-orange-900 font-medium">Total Estourado:</span>
              <span className="text-orange-700 font-bold">
                {formatCurrency(budgetAlerts.reduce((sum, a) => sum + a.overrun, 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}