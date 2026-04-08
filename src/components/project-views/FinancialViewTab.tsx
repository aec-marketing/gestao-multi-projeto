'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Project, Task, Resource, ProjectExpense } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { supabase } from '@/lib/supabase'
import { dispatchToast } from '@/components/ui/ToastProvider'
import { ProjectExpenses } from '@/components/table-view/ProjectExpenses'

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
  // ONDA 5.7: Estados para campos editáveis do projeto
  const [saleValue, setSaleValue] = useState<string>(project.sale_value?.toString() || '')
  const [isEditingSaleValue, setIsEditingSaleValue] = useState(false)
  const [isSavingSaleValue, setIsSavingSaleValue] = useState(false)

  // Despesas avulsas (buscadas localmente)
  const [expenses, setExpenses] = useState<ProjectExpense[]>([])
  const fetchExpenses = useCallback(async () => {
    const { data } = await supabase
      .from('project_expenses')
      .select('*')
      .eq('project_id', project.id)
      .order('expense_date', { ascending: true })
    setExpenses(data ?? [])
  }, [project.id])
  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  /**
   * Calcula custo de alocação de uma tarefa client-side.
   * Usa allocated_minutes (se preenchido) ou duration_minutes da task.
   */
  const allocationCostByTask = useMemo(() => {
    const map = new Map<string, number>()
    allocations.forEach(alloc => {
      const resource = resources.find(r => r.id === alloc.resource_id)
      const task = tasks.find(t => t.id === alloc.task_id)
      if (!resource || !task) return

      const minutes = alloc.allocated_minutes ?? task.duration_minutes ?? 0
      const overtime = alloc.overtime_minutes ?? 0
      const multiplier = alloc.overtime_multiplier ?? 1.5
      const cost = (minutes / 60) * resource.hourly_rate + (overtime / 60) * resource.hourly_rate * multiplier

      map.set(alloc.task_id, (map.get(alloc.task_id) ?? 0) + cost)
    })
    return map
  }, [allocations, resources, tasks])

  // IDs de tarefas que têm filhas — calculado antes dos memos que dependem dele
  const parentIdsSet = useMemo(
    () => new Set(tasks.map(t => t.parent_id).filter(Boolean) as string[]),
    [tasks]
  )

  // Custo total das tarefas — apenas folhas (evita double-counting de pais)
  const totalEstimated = useMemo(
    () => tasks
      .filter(t => !parentIdsSet.has(t.id))
      .reduce((sum, t) => sum + (t.estimated_cost || 0), 0),
    [tasks, parentIdsSet]
  )

  // Custo total por alocação — calculado client-side a partir de hourly_rate * minutos
  const totalAllocationCost = useMemo(
    () => Array.from(allocationCostByTask.values()).reduce((sum, v) => sum + v, 0),
    [allocationCostByTask]
  )

  // Custo total = custo das tarefas + custo por alocação + despesas avulsas
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses])
  const totalCost = totalEstimated + totalAllocationCost + totalExpenses

  // "Estouro/Economia" compara custo total com o orçamento definido
  const budgetNum = project.budget ?? 0
  const budgetDiff = budgetNum > 0 ? budgetNum - totalCost : null
  // % executado: média de progresso ponderada pelo custo da tarefa (ou simples se sem custo)
  const percentExecuted = useMemo(() => {
    const leafTasks = tasks.filter(t => !tasks.some(other => other.parent_id === t.id))
    if (leafTasks.length === 0) return 0
    const total = leafTasks.reduce((sum, t) => sum + (t.progress ?? 0), 0)
    return total / leafTasks.length
  }, [tasks])

  // ONDA 5.7: Calcular margem de lucro
  const saleValueNum = parseFloat(saleValue) || 0
  const profitMargin = saleValueNum - totalCost
  const profitMarginPercent = saleValueNum > 0 ? (profitMargin / saleValueNum) * 100 : 0

  // ONDA 5.7: Handler para salvar valor de venda
  const handleSaveSaleValue = async () => {
    setIsSavingSaleValue(true)
    try {
      const valueToSave = parseFloat(saleValue) || 0

      const { error } = await supabase
        .from('projects')
        .update({ sale_value: valueToSave })
        .eq('id', project.id)

      if (error) throw error

      dispatchToast('Valor de venda salvo com sucesso!', 'success')
      setIsEditingSaleValue(false)
      onRefresh()
    } catch (error) {
      console.error('Erro ao salvar valor de venda:', error)
      dispatchToast('Erro ao salvar valor de venda', 'error')
    } finally {
      setIsSavingSaleValue(false)
    }
  }

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

  // Tarefas folha onde custo por alocação supera o custo estimado da tarefa
  const budgetAlerts = useMemo(() => {
    return tasks
      .filter(task => !parentIdsSet.has(task.id))
      .filter(task => {
        const estimated = task.estimated_cost || 0
        const allocCost = allocationCostByTask.get(task.id) ?? 0
        return allocCost > estimated && estimated > 0
      })
      .map(task => {
        const estimated = task.estimated_cost || 0
        const allocCost = allocationCostByTask.get(task.id) ?? 0
        const overrun = allocCost - estimated
        const overrunPercent = (overrun / estimated) * 100
        return { task, estimated, allocCost, overrun, overrunPercent }
      })
      .sort((a, b) => b.overrunPercent - a.overrunPercent)
      .slice(0, 10)
  }, [tasks, allocationCostByTask])

  // ONDA 3: Total de hora extra
  const totalOvertimeCost = overtimeTasks.reduce((sum, t) => sum + t.overtimeCost, 0)
  const totalOvertimeHours = overtimeTasks.reduce((sum, t) => sum + t.overtimeHours, 0)

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
  }



  // Top 5 tarefas mais caras — tarefas folha, ordenadas por custo total
  const topTasks = useMemo(() => {
    return [...tasks]
      .filter(t => !parentIdsSet.has(t.id))  // apenas folhas
      .map(t => ({
        task: t,
        taskCost: t.estimated_cost || 0,
        allocCost: allocationCostByTask.get(t.id) ?? 0,
        total: (t.estimated_cost || 0) + (allocationCostByTask.get(t.id) ?? 0)
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [tasks, allocationCostByTask, parentIdsSet])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Dashboard Financeiro</h2>
        <p className="text-sm text-gray-600">
          Visão consolidada dos custos do projeto
        </p>
      </div>

      {/* ONDA 5.7: Valores Financeiros do Projeto */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          💰 Valores Financeiros do Projeto
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Valor de Venda */}
          <div className="bg-white rounded-lg border-2 border-purple-300 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-purple-900">Valor de Venda</p>
              {!isEditingSaleValue && (
                <button
                  onClick={() => setIsEditingSaleValue(true)}
                  className="text-xs text-purple-600 hover:text-purple-800 underline"
                >
                  Editar
                </button>
              )}
            </div>

            {isEditingSaleValue ? (
              <div className="space-y-2">
                <input
                  type="number"
                  step="0.01"
                  value={saleValue}
                  onChange={(e) => setSaleValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm text-gray-900 bg-white"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSaleValue}
                    disabled={isSavingSaleValue}
                    className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                  >
                    {isSavingSaleValue ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingSaleValue(false)
                      setSaleValue(project.sale_value?.toString() || '')
                    }}
                    disabled={isSavingSaleValue}
                    className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-xs font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-purple-700">
                {saleValueNum > 0 ? formatCurrency(saleValueNum) : '— Não definido'}
              </p>
            )}

            <p className="text-xs text-gray-500 mt-2">
              Valor pelo qual o projeto será vendido ao cliente
            </p>
          </div>

          {/* Custo Total do Projeto (read-only) */}
          <div className="bg-white rounded-lg border-2 border-green-300 p-4">
            <p className="text-sm font-medium text-green-900 mb-2">Custo Total do Projeto</p>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(totalCost)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Tarefas + alocações + despesas avulsas
            </p>
          </div>

          {/* Margem de Lucro (calculado) */}
          <div className="bg-white rounded-lg border-2 border-blue-300 p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">Margem de Lucro</p>
            {saleValueNum > 0 ? (
              <>
                <p className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(Math.abs(profitMargin))}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">
                    {profitMargin >= 0 ? 'Lucro' : 'Prejuízo'}
                  </p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    profitMarginPercent >= 20 ? 'bg-green-100 text-green-700' :
                    profitMarginPercent >= 10 ? 'bg-yellow-100 text-yellow-700' :
                    profitMarginPercent >= 0 ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {profitMarginPercent.toFixed(1)}%
                  </span>
                </div>
              </>
            ) : (
              <p className="text-lg text-gray-400 italic">
                Define o valor de venda para calcular
              </p>
            )}
          </div>
        </div>

        {/* Indicador visual de margem */}
        {saleValueNum > 0 && (
          <div className="mt-4 p-3 bg-white rounded-lg border">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-gray-700">Composição do Valor de Venda:</span>
              <span className="text-gray-500 text-xs">
                {formatCurrency(saleValueNum)} total
              </span>
            </div>
            <div className="h-6 bg-gray-200 rounded-full overflow-hidden flex">
              <div
                className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${Math.min((totalCost / saleValueNum) * 100, 100)}%` }}
                title={`Custo: ${formatCurrency(totalCost)}`}
              >
                {((totalCost / saleValueNum) * 100) > 15 && 'Custo'}
              </div>
              <div
                className={`flex items-center justify-center text-white text-xs font-medium ${
                  profitMargin >= 0 ? 'bg-blue-600' : 'bg-red-600'
                }`}
                style={{ width: `${Math.abs((profitMargin / saleValueNum) * 100)}%` }}
                title={`${profitMargin >= 0 ? 'Lucro' : 'Prejuízo'}: ${formatCurrency(Math.abs(profitMargin))}`}
              >
                {Math.abs((profitMargin / saleValueNum) * 100) > 15 && (profitMargin >= 0 ? 'Lucro' : 'Prejuízo')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Custo das Tarefas */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Custo das Tarefas</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(totalEstimated)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        {/* Custo por Alocação */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Custo por Alocação</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(totalAllocationCost)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        {/* Orçamento vs Custo Total */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">
                {budgetDiff === null ? 'Orçamento' : budgetDiff >= 0 ? 'Disponível' : 'Estouro'}
              </p>
              <p className={`text-2xl font-bold ${
                budgetDiff === null ? 'text-gray-400' :
                budgetDiff >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {budgetDiff === null ? '—' : formatCurrency(Math.abs(budgetDiff))}
              </p>
              {budgetDiff === null && (
                <p className="text-xs text-gray-400">Defina orçamento na aba Tabela</p>
              )}
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              budgetDiff === null ? 'bg-gray-100' :
              budgetDiff >= 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <span className="text-2xl">{budgetDiff === null ? '💼' : budgetDiff >= 0 ? '✅' : '⚠️'}</span>
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

      {/* Custos por Tarefa */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🏆 Custos por Tarefa
        </h3>

        {topTasks.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhuma tarefa com custo cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {topTasks.map((item) => {
              const grandTotal = totalEstimated + totalAllocationCost
              const percentage = grandTotal > 0 ? (item.total / grandTotal) * 100 : 0
              return (
                <div key={item.task.id} className="border-b pb-2 last:border-b-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800 truncate max-w-[55%]" title={item.task.name}>
                      {item.task.name}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">{percentage.toFixed(1)}%</span>
                  </div>
                  {(item.taskCost > 0 || item.allocCost > 0) && (
                    <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                      {item.taskCost > 0 && <span>Tarefa: {formatCurrency(item.taskCost)}</span>}
                      {item.allocCost > 0 && <span className="text-purple-500">Alocação: {formatCurrency(item.allocCost)}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Custo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Por Alocação</th>
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
                      {formatCurrency(alert.allocCost)}
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

      {/* Despesas Avulsas */}
      <ProjectExpenses
        projectId={project.id}
        expenses={expenses}
        onExpensesChanged={fetchExpenses}
      />
    </div>
  )
}