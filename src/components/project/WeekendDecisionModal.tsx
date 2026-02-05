'use client'

import { useState } from 'react'
import { formatCurrency } from '@/utils/cost.utils'
import { formatMinutes } from '@/utils/time.utils'

/**
 * 🌊 ONDA 4.2: Interface para decisão de fim de semana
 */
export interface WeekendDecision {
  date: string
  useWeekend: boolean // true = trabalhar no fim de semana, false = pular
  minutesToWork: number // Minutos a trabalhar (se useWeekend = true)
}

/**
 * 🌊 ONDA 4.2: Informações de um fim de semana que precisa de decisão
 */
export interface WeekendDay {
  date: string
  dayOfWeek: string // "Sábado" ou "Domingo"
  remainingMinutes: number // Minutos restantes da tarefa neste ponto
}

interface WeekendDecisionModalProps {
  weekends: WeekendDay[]
  resourceName: string
  resourceHourlyRate: number
  taskName: string
  totalMinutes: number
  onConfirm: (decisions: WeekendDecision[]) => void
  onCancel: () => void
}

export function WeekendDecisionModal({
  weekends,
  resourceName,
  resourceHourlyRate,
  taskName,
  totalMinutes,
  onConfirm,
  onCancel
}: WeekendDecisionModalProps) {
  // Estado: decisões do usuário para cada fim de semana
  const [decisions, setDecisions] = useState<Map<string, WeekendDecision>>(new Map())
  const [currentWeekendIndex, setCurrentWeekendIndex] = useState(0)

  // Fim de semana atual sendo decidido
  const currentWeekend = weekends[currentWeekendIndex]
  const isLastWeekend = currentWeekendIndex === weekends.length - 1

  // Calcular custo estimado COM AS DECISÕES ATUAIS
  const calculateEstimatedCost = () => {
    const costPerMinute = resourceHourlyRate / 60
    let totalCost = 0

    // Custo base (dias úteis) - assumindo que já foi calculado
    // Aqui vamos somar APENAS o custo dos fins de semana

    for (const weekend of weekends) {
      const decision = decisions.get(weekend.date)

      if (decision?.useWeekend) {
        // Usuário escolheu trabalhar no fim de semana (2.0×)
        const weekendCost = decision.minutesToWork * costPerMinute * 2.0
        totalCost += weekendCost
      }
      // Se pular, não adiciona custo
    }

    return totalCost
  }

  const estimatedWeekendCost = calculateEstimatedCost()

  /**
   * Aplicar decisão para o fim de semana atual
   */
  const handleWeekendDecision = (useWeekend: boolean) => {
    if (!currentWeekend) return

    const decision: WeekendDecision = {
      date: currentWeekend.date,
      useWeekend,
      minutesToWork: useWeekend ? Math.min(currentWeekend.remainingMinutes, 540) : 0 // Máximo 9h por dia
    }

    const newDecisions = new Map(decisions)
    newDecisions.set(currentWeekend.date, decision)
    setDecisions(newDecisions)

    // Se for o último fim de semana, confirmar
    if (isLastWeekend) {
      onConfirm(Array.from(newDecisions.values()))
    } else {
      // Próximo fim de semana
      setCurrentWeekendIndex(prev => prev + 1)
    }
  }

  /**
   * Voltar para fim de semana anterior
   */
  const handleBack = () => {
    if (currentWeekendIndex > 0) {
      setCurrentWeekendIndex(prev => prev - 1)
    }
  }

  if (!currentWeekend) {
    // Não há fins de semana - confirmar direto
    onConfirm([])
    return null
  }

  // Calcular estimativas
  const remainingHours = (currentWeekend.remainingMinutes / 60).toFixed(1)
  const dailyCapacityHours = 9
  const willWorkHours = Math.min(currentWeekend.remainingMinutes / 60, dailyCapacityHours).toFixed(1)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">
                🏖️ Fim de Semana Detectado
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
              <span>Fim de semana {currentWeekendIndex + 1} de {weekends.length}</span>
              <span>{Math.round(((currentWeekendIndex + 1) / weekends.length) * 100)}% completo</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentWeekendIndex + 1) / weekends.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Custo Extra de Fim de Semana */}
          <div className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-purple-900">Custo Extra (Fins de Semana)</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-700">
                  {formatCurrency(estimatedWeekendCost)}
                </div>
                <div className="text-[10px] text-purple-600">
                  Multiplicador 2.0× (CLT)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Weekend */}
        <div className="p-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-purple-900">
                  {new Date(currentWeekend.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
                <div className="text-xs text-purple-700 mt-0.5">
                  🏖️ {currentWeekend.dayOfWeek}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-purple-900">
                  {remainingHours}h restantes
                </div>
                <div className="text-xs text-gray-600">
                  da tarefa
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              A tarefa ainda precisa de <span className="font-semibold">{remainingHours}h</span> de trabalho.
              <br />
              Como deseja prosseguir?
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-900">
                ⚠️ <span className="font-semibold">Importante:</span> Trabalhar em fins de semana conta como hora extra com multiplicador 2.0× (CLT).
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="mt-6 space-y-3">
            {/* Opção 1: Pular fim de semana */}
            <button
              onClick={() => handleWeekendDecision(false)}
              className="w-full text-left p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 group-hover:text-blue-900">
                    📅 Pular para próxima segunda-feira
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Continuar o trabalho apenas em dias úteis (sem custo extra)
                  </div>
                </div>
                <div className="ml-4 text-sm font-medium text-green-600">
                  Sem custo extra
                </div>
              </div>
            </button>

            {/* Opção 2: Trabalhar no fim de semana */}
            <button
              onClick={() => handleWeekendDecision(true)}
              className="w-full text-left p-4 border-2 border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 group-hover:text-purple-900">
                    ⏰ Trabalhar no {currentWeekend.dayOfWeek.toLowerCase()} (hora extra 2.0×)
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Alocar até {willWorkHours}h neste dia com multiplicador 2.0× (CLT)
                  </div>
                  <div className="text-xs text-purple-700 font-medium mt-1">
                    Custo: {formatCurrency((parseFloat(willWorkHours) * resourceHourlyRate * 2.0))}
                  </div>
                </div>
                <div className="ml-4 text-sm font-medium text-purple-600">
                  +100%
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
              disabled={currentWeekendIndex === 0}
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
