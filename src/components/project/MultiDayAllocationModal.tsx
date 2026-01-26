'use client'

import { useState } from 'react'
import { MultiDayAllocationPlan, AllocationDayPlan } from '@/utils/allocation.utils'
import { formatCurrency } from '@/utils/cost.utils'
import { formatMinutes } from '@/utils/time.utils'

interface MultiDayAllocationModalProps {
  plan: MultiDayAllocationPlan
  resourceName: string
  resourceHourlyRate: number
  taskName: string
  onConfirm: (decisions: DayDecision[]) => void
  onCancel: () => void
}

export interface DayDecision {
  date: string
  useOvertime: boolean
  overtimeMinutes: number
  overtimeMultiplier: number
}

export function MultiDayAllocationModal({
  plan,
  resourceName,
  resourceHourlyRate,
  taskName,
  onConfirm,
  onCancel
}: MultiDayAllocationModalProps) {
  // Estado: decisões do usuário para cada dia com overflow
  const [decisions, setDecisions] = useState<Map<string, DayDecision>>(new Map())
  const [currentDayIndex, setCurrentDayIndex] = useState(0)

  // Filtrar apenas dias com overflow que precisam de decisão
  const daysNeedingDecision = plan.days.filter(d => d.hasOverflow)

  // Dia atual sendo decidido
  const currentDay = daysNeedingDecision[currentDayIndex]
  const isLastDay = currentDayIndex === daysNeedingDecision.length - 1

  // Calcular custo estimado COM AS DECISÕES ATUAIS
  const calculateEstimatedCost = () => {
    const costPerMinute = resourceHourlyRate / 60
    let totalCost = 0

    // Para cada dia do plano
    for (const day of plan.days) {
      const decision = decisions.get(day.date)

      if (day.hasOverflow) {
        // Dia com overflow - verificar decisão
        if (decision?.useOvertime) {
          // Usuário escolheu usar hora extra
          const normalCost = day.normalMinutes * costPerMinute
          const overtimeCost = decision.overtimeMinutes * costPerMinute * decision.overtimeMultiplier
          totalCost += normalCost + overtimeCost
        } else {
          // Usuário escolheu empurrar (ou ainda não decidiu)
          const normalCost = day.normalMinutes * costPerMinute
          totalCost += normalCost
        }
      } else {
        // Dia sem overflow - custo normal
        totalCost += day.normalMinutes * costPerMinute
      }
    }

    return totalCost
  }

  const estimatedCost = calculateEstimatedCost()

  /**
   * Aplicar decisão para o dia atual
   */
  const handleDayDecision = (useOvertime: boolean) => {
    if (!currentDay) return

    const decision: DayDecision = {
      date: currentDay.date,
      useOvertime,
      overtimeMinutes: useOvertime ? Math.min(currentDay.overflowMinutes, currentDay.isWeekend ? Infinity : 120) : 0,
      overtimeMultiplier: useOvertime ? (currentDay.isWeekend ? 2.0 : 1.5) : 1.0
    }

    const newDecisions = new Map(decisions)
    newDecisions.set(currentDay.date, decision)
    setDecisions(newDecisions)

    // Se for o último dia, confirmar
    if (isLastDay) {
      onConfirm(Array.from(newDecisions.values()))
    } else {
      // Próximo dia
      setCurrentDayIndex(prev => prev + 1)
    }
  }

  /**
   * Voltar para dia anterior
   */
  const handleBack = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(prev => prev - 1)
    }
  }

  if (!currentDay) {
    // Não há dias com overflow - confirmar direto
    onConfirm([])
    return null
  }

  // Calcular estimativas
  const overtimeHours = (currentDay.overflowMinutes / 60).toFixed(1)
  const maxOvertimeHours = currentDay.isWeekend ? overtimeHours : Math.min(2, parseFloat(overtimeHours)).toFixed(1)
  const exceededHours = currentDay.isWeekend ? 0 : Math.max(0, parseFloat(overtimeHours) - 2).toFixed(1)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">
                ⏳ Alocação Multi-Dia Detectada
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {resourceName} • {taskName}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 ml-4"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Dia {currentDayIndex + 1} de {daysNeedingDecision.length}</span>
              <span>{Math.round(((currentDayIndex + 1) / daysNeedingDecision.length) * 100)}% completo</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentDayIndex + 1) / daysNeedingDecision.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Custo Estimado em Tempo Real */}
          <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-green-900">Custo Estimado</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-700">
                  {formatCurrency(estimatedCost)}
                </div>
                <div className="text-[10px] text-green-600">
                  {formatMinutes(plan.totalMinutes)} • {plan.days.length} dia{plan.days.length > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Day */}
        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-blue-900">
                  {new Date(currentDay.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
                <div className="text-xs text-blue-700 mt-0.5">
                  {currentDay.isWeekend ? '🏖️ Fim de semana' : '📅 Dia útil'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blue-900">
                  {formatMinutes(currentDay.normalMinutes)} normais
                </div>
                <div className="text-xs text-orange-600 font-semibold">
                  + {formatMinutes(currentDay.overflowMinutes)} excedente
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Capacidade disponível:</span> {formatMinutes(currentDay.normalMinutes)}
              <br />
              <span className="font-semibold">Trabalho excedente:</span> {formatMinutes(currentDay.overflowMinutes)}
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-900">
                ⚠️ <span className="font-semibold">Decisão necessária:</span> Como deseja tratar o excedente de {overtimeHours}h?
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="mt-6 space-y-3">
            {/* Opção 1: Empurrar para próximo dia */}
            <button
              onClick={() => handleDayDecision(false)}
              className="w-full text-left p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 group-hover:text-blue-900">
                    📅 Empurrar para próximo dia
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Alocar {overtimeHours}h no próximo dia útil (sem custo extra)
                  </div>
                </div>
                <div className="ml-4 text-sm font-medium text-green-600">
                  Sem custo extra
                </div>
              </div>
            </button>

            {/* Opção 2: Usar hora extra */}
            <button
              onClick={() => handleDayDecision(true)}
              className="w-full text-left p-4 border-2 border-orange-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 group-hover:text-orange-900">
                    ⏰ Usar hora extra {currentDay.isWeekend ? '(fim de semana)' : '(dia útil)'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {currentDay.isWeekend ? (
                      <>
                        {maxOvertimeHours}h extras com multiplicador 2.0× (CLT)
                      </>
                    ) : (
                      <>
                        {maxOvertimeHours}h extras (limite CLT) com multiplicador 1.5×
                        {parseFloat(exceededHours) > 0 && (
                          <span className="text-orange-600 font-medium"> + {exceededHours}h empurrado para próximo dia</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="ml-4 text-sm font-medium text-orange-600">
                  {currentDay.isWeekend ? '+100%' : '+50%'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentDayIndex === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Voltar
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
