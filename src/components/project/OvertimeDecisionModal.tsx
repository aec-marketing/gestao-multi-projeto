/**
 * =====================================================
 * ONDA 3: Modal de Decisão de Hora Extra
 * =====================================================
 *
 * Filosofia: "Hora extra NUNCA é automática. Sempre decisão consciente do usuário."
 *
 * Este modal apresenta 3 opções quando uma alocação excede a capacidade:
 * 1. Empurrar para próximo dia (sem custo extra)
 * 2. Usar hora extra em dia útil (1.5×)
 * 3. Trabalhar no fim de semana (2.0×)
 */

'use client'

import { Resource } from '@/types/database.types'
import { CapacityOverflowResult, OvertimeOption } from '@/utils/allocation.utils'

interface OvertimeDecisionModalProps {
  isOpen: boolean
  resource: Resource
  overflow: CapacityOverflowResult
  options: OvertimeOption[]
  onSelect: (option: OvertimeOption) => void
  onCancel: () => void
}

export function OvertimeDecisionModal({
  isOpen,
  resource,
  overflow,
  options,
  onSelect,
  onCancel
}: OvertimeDecisionModalProps) {
  if (!isOpen || !resource) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-orange-600 text-white px-6 py-4 rounded-t-lg">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h2 className="text-xl font-bold">Capacidade Excedida</h2>
              <p className="text-sm text-orange-100 mt-1">
                {resource.name} não tem capacidade suficiente neste dia
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Informações do Overflow */}
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-orange-900 mb-3">
              Situação Atual
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-orange-700 mb-1">Capacidade Disponível</p>
                <p className="text-lg font-bold text-orange-900">
                  {(overflow.minutesAvailable / 60).toFixed(1)}h
                </p>
              </div>

              <div>
                <p className="text-xs text-orange-700 mb-1">Minutos Necessários</p>
                <p className="text-lg font-bold text-orange-900">
                  {(overflow.minutesNeeded / 60).toFixed(1)}h
                </p>
              </div>

              <div>
                <p className="text-xs text-red-700 mb-1">Excedente</p>
                <p className="text-lg font-bold text-red-600">
                  +{(overflow.minutesOverflow / 60).toFixed(1)}h
                </p>
              </div>
            </div>

            {/* Barra visual */}
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="flex h-full">
                  {/* Parte disponível */}
                  <div
                    className="bg-green-500"
                    style={{
                      width: `${Math.min(100, (overflow.minutesAvailable / overflow.minutesNeeded) * 100)}%`
                    }}
                  />
                  {/* Parte excedente */}
                  <div
                    className="bg-red-500"
                    style={{
                      width: `${(overflow.minutesOverflow / overflow.minutesNeeded) * 100}%`
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>✅ Disponível</span>
                <span>❌ Excedente: {(overflow.minutesOverflow / 60).toFixed(1)}h</span>
              </div>
            </div>
          </div>

          {/* Opções de Resolução */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Como deseja resolver?
            </h3>

            <div className="space-y-3">
              {options.map((option) => (
                <button
                  key={option.type}
                  onClick={() => onSelect(option)}
                  className={`w-full text-left border-2 rounded-lg p-4 transition-all hover:shadow-lg hover:scale-[1.02] ${getOptionStyles(option.type)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getOptionIcon(option.type)}</span>
                        <h4 className="text-base font-bold text-gray-900">
                          {option.label}
                        </h4>
                      </div>

                      <p className="text-sm text-gray-700 mb-3">
                        {option.description}
                      </p>

                      <div className="flex items-center gap-4">
                        {/* Custo */}
                        <div className="bg-white rounded px-3 py-1 border">
                          <p className="text-xs text-gray-600">Custo</p>
                          <p className="text-sm font-bold text-gray-900">
                            R$ {option.estimatedCost.toFixed(2)}
                          </p>
                        </div>

                        {/* Multiplicador */}
                        {option.multiplier > 1.0 && (
                          <div className="bg-red-50 rounded px-3 py-1 border border-red-200">
                            <p className="text-xs text-red-700">Multiplicador CLT</p>
                            <p className="text-sm font-bold text-red-600">
                              {option.multiplier}× (+{((option.multiplier - 1) * 100).toFixed(0)}%)
                            </p>
                          </div>
                        )}

                        {/* Nova data */}
                        {option.newEndDate && (
                          <div className="bg-blue-50 rounded px-3 py-1 border border-blue-200">
                            <p className="text-xs text-blue-700">Nova data</p>
                            <p className="text-sm font-bold text-blue-600">
                              {formatDateBR(option.newEndDate)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ícone de seta */}
                    <div className="ml-3 text-gray-400">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Indicador de recomendação */}
                  {option.type === 'push_date' && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs text-green-700 font-medium">
                        ✅ Recomendado: Sem custo adicional
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Aviso CLT */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <span className="text-xl">ℹ️</span>
              <div className="text-xs text-blue-900">
                <p className="font-semibold mb-1">Multiplicadores conforme CLT (Brasil)</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Dias úteis: 1.5× (50% adicional)</li>
                  <li>Fins de semana e feriados: 2.0× (100% adicional)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end gap-3 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// Helpers

function getOptionStyles(type: string): string {
  switch (type) {
    case 'push_date':
      return 'border-green-300 bg-green-50 hover:border-green-500'
    case 'overtime_weekday':
      return 'border-orange-300 bg-orange-50 hover:border-orange-500'
    case 'overtime_weekend':
      return 'border-red-300 bg-red-50 hover:border-red-500'
    default:
      return 'border-gray-300 bg-gray-50 hover:border-gray-500'
  }
}

function getOptionIcon(type: string): string {
  switch (type) {
    case 'push_date':
      return '📅'
    case 'overtime_weekday':
      return '⏰'
    case 'overtime_weekend':
      return '📆'
    default:
      return '❓'
  }
}

function formatDateBR(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${day}/${month}`
}
