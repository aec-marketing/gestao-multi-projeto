'use client'

import { useState, useEffect } from 'react'
import { Clock, AlertTriangle, Info, TrendingUp, TrendingDown } from 'lucide-react'
import { Project, Task } from '@/types/database.types'
import { calculateProjectBuffer, formatBufferStatus } from '@/lib/buffer-utils'

interface BufferConfigurationProps {
  project: Project
  tasks: Task[]
  bufferDays: number
  onBufferChange: (days: number) => void
  disabled?: boolean
}

export default function BufferConfiguration({
  project,
  tasks,
  bufferDays,
  onBufferChange,
  disabled = false
}: BufferConfigurationProps) {
  const [previewBuffer, setPreviewBuffer] = useState(bufferDays)

  // Atualizar preview quando prop muda
  useEffect(() => {
    setPreviewBuffer(bufferDays)
  }, [bufferDays])

  // Calcular informações atuais e de preview
  const currentBufferInfo = calculateProjectBuffer(project, tasks)
  const previewProject = { ...project, buffer_days: previewBuffer }
  const previewBufferInfo = calculateProjectBuffer(previewProject, tasks)

  const currentStatus = formatBufferStatus(currentBufferInfo)
  const previewStatus = formatBufferStatus(previewBufferInfo)

  const handleBufferChange = (newBuffer: number) => {
    const clampedBuffer = Math.max(0, Math.min(30, newBuffer)) // Limite entre 0-30 dias
    setPreviewBuffer(clampedBuffer)
    onBufferChange(clampedBuffer)
  }

  const suggestions = getBufferSuggestions(tasks.length, project.complexity)

  return (
    <div className="space-y-4">
      {/* Título da seção */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-600" />
        <h3 className="font-medium text-gray-900">Configuração de Buffer</h3>
      </div>

      {/* Input principal */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dias de Buffer
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="30"
              value={previewBuffer}
              onChange={(e) => handleBufferChange(parseInt(e.target.value) || 0)}
              disabled={disabled}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-500">dias</span>
          </div>
        </div>

        {/* Controles rápidos */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => handleBufferChange(previewBuffer + 1)}
            disabled={disabled || previewBuffer >= 30}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleBufferChange(previewBuffer - 1)}
            disabled={disabled || previewBuffer <= 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <TrendingDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sugestões baseadas no projeto */}
      {suggestions.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-blue-900">Sugestões</div>
              <div className="text-sm text-blue-700 mt-1">
                Para projetos {project.complexity} com {tasks.length} tarefas:
              </div>
              <div className="flex gap-2 mt-2">
                {suggestions.map(suggestion => (
                  <button
                    key={suggestion.days}
                    type="button"
                    onClick={() => handleBufferChange(suggestion.days)}
                    disabled={disabled}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    {suggestion.days}d ({suggestion.label})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview do impacto */}
      {previewBuffer !== bufferDays && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          {/* Status atual */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">ATUAL</div>
            <div className={`
              flex items-center gap-2 p-2 rounded-md text-sm
              ${currentStatus.color === 'green' ? 'bg-green-100 text-green-800' : ''}
              ${currentStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : ''}
              ${currentStatus.color === 'red' ? 'bg-red-100 text-red-800' : ''}
            `}>
              <span>{currentStatus.icon}</span>
              <span>{bufferDays} dias</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Fim: {currentBufferInfo.bufferEndDate.toLocaleDateString('pt-BR')}
            </div>
          </div>

          {/* Preview */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">PREVIEW</div>
            <div className={`
              flex items-center gap-2 p-2 rounded-md text-sm
              ${previewStatus.color === 'green' ? 'bg-green-100 text-green-800' : ''}
              ${previewStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : ''}
              ${previewStatus.color === 'red' ? 'bg-red-100 text-red-800' : ''}
            `}>
              <span>{previewStatus.icon}</span>
              <span>{previewBuffer} dias</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Fim: {previewBufferInfo.bufferEndDate.toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      )}

      {/* Explicação do conceito */}
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-600">
            <div className="font-medium">O que é Buffer?</div>
            <div className="mt-1">
              Buffer é tempo extra adicionado ao final do projeto para absorver atrasos inesperados.
              É calculado após a última tarefa e serve como margem de segurança para cumprir prazos.
            </div>
          </div>
        </div>
      </div>

      {/* Alerta se buffer muito alto */}
      {previewBuffer > 15 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <div className="font-medium">Buffer Alto</div>
              <div className="mt-1">
                Buffer de {previewBuffer} dias pode ser excessivo.
                Considere otimizar o cronograma das tarefas antes de aumentar o buffer.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Gera sugestões de buffer baseadas no tamanho e complexidade do projeto
 */
function getBufferSuggestions(taskCount: number, complexity: string) {
  const suggestions = []

  // Base por complexidade
  let baseBuffer = 2
  switch (complexity) {
    case 'simples':
      baseBuffer = 1
      break
    case 'complexo':
      baseBuffer = 3
      break
    default: // padrão
      baseBuffer = 2
  }

  // Ajuste por número de tarefas
  let taskMultiplier = 1
  if (taskCount > 20) taskMultiplier = 1.5
  if (taskCount > 50) taskMultiplier = 2

  const recommended = Math.ceil(baseBuffer * taskMultiplier)

  // Gerar opções
  suggestions.push({ days: recommended, label: 'Recomendado' })

  if (recommended > 1) {
    suggestions.push({ days: recommended - 1, label: 'Conservador' })
  }

  if (recommended < 7) {
    suggestions.push({ days: recommended + 2, label: 'Seguro' })
  }

  return suggestions.slice(0, 3) // Máximo 3 sugestões
}
