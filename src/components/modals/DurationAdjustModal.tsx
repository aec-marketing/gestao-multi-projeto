'use client'

import React from 'react'

export type DurationAdjustmentType = 'extend_end' | 'pull_start' | 'add_lag'

export interface DurationAdjustModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (adjustmentType: DurationAdjustmentType) => void
  taskName: string
  currentStartDate: string
  currentEndDate: string
  currentDuration: number
  newDuration: number
}

/**
 * Modal para escolher como ajustar uma tarefa quando a duração é alterada
 */
export function DurationAdjustModal({
  isOpen,
  onClose,
  onConfirm,
  taskName,
  currentStartDate,
  currentEndDate,
  currentDuration,
  newDuration
}: DurationAdjustModalProps) {
  if (!isOpen) return null

  const durationDiff = newDuration - currentDuration
  const isIncrease = durationDiff > 0
  const diffText = Math.abs(durationDiff)
  const diffLabel = diffText === 1 ? 'dia' : 'dias'

  // Calcular as datas resultantes para cada opção
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('pt-BR')
  }

  const calculateNewEndDate = () => {
    const start = new Date(currentStartDate + 'T00:00:00')
    start.setDate(start.getDate() + newDuration - 1)
    return start.toISOString().split('T')[0]
  }

  const calculateNewStartDate = () => {
    const end = new Date(currentEndDate + 'T00:00:00')
    end.setDate(end.getDate() - newDuration + 1)
    return end.toISOString().split('T')[0]
  }

  const newEndDate = calculateNewEndDate()
  const newStartDate = calculateNewStartDate()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white">
            Ajustar Duração da Tarefa
          </h2>
          <p className="text-blue-100 text-sm mt-1">{taskName}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Current vs New */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Duração Atual:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {currentDuration} {currentDuration === 1 ? 'dia' : 'dias'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Nova Duração:</span>
                <span className="ml-2 font-semibold text-blue-600">
                  {newDuration} {newDuration === 1 ? 'dia' : 'dias'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Datas Atuais:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {formatDate(currentStartDate)} até {formatDate(currentEndDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-4">
              Como você deseja ajustar a tarefa?
            </p>

            {/* Option 1: Extend End Date */}
            <button
              onClick={() => onConfirm('extend_end')}
              className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-blue-500 group-hover:bg-blue-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100"></div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">
                    {isIncrease ? 'Acrescentar' : 'Reduzir'} dias no final
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {isIncrease
                      ? `Adicionar ${diffText} ${diffLabel} ao final da tarefa`
                      : `Remover ${diffText} ${diffLabel} do final da tarefa`
                    }
                  </div>
                  <div className="text-sm bg-white px-3 py-2 rounded border border-gray-200">
                    <span className="text-gray-500">Nova data:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {formatDate(currentStartDate)} até {formatDate(newEndDate)}
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Option 2: Pull Start Date */}
            <button
              onClick={() => onConfirm('pull_start')}
              className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-purple-500 group-hover:bg-purple-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100"></div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">
                    {isIncrease ? 'Adiantar' : 'Atrasar'} início
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {isIncrease
                      ? `Mover data de início ${diffText} ${diffLabel} para trás`
                      : `Mover data de início ${diffText} ${diffLabel} para frente`
                    }
                  </div>
                  <div className="text-sm bg-white px-3 py-2 rounded border border-gray-200">
                    <span className="text-gray-500">Nova data:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {formatDate(newStartDate)} até {formatDate(currentEndDate)}
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Option 3: Add Lag (only for increases) */}
            {isIncrease && (
              <button
                onClick={() => onConfirm('add_lag')}
                className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-green-500 group-hover:bg-green-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100"></div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">
                      Definir como Lag/Buffer
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Adicionar {diffText} {diffLabel} de folga sem alterar as datas
                    </div>
                    <div className="text-sm bg-white px-3 py-2 rounded border border-gray-200">
                      <span className="text-gray-500">Datas mantidas:</span>{' '}
                      <span className="font-medium text-gray-900">
                        {formatDate(currentStartDate)} até {formatDate(currentEndDate)}
                      </span>
                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        +{diffText} {diffLabel} de folga
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 italic">
                      Esta folga não afeta o cronograma final, mas pode ser usada se necessário
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
