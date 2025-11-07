'use client'

import { useState } from 'react'
import { Calendar, Target, Clock, AlertTriangle } from 'lucide-react'
import { Project, Task } from '@/types/database.types'
import { calculateProjectBuffer, formatBufferStatus, generateBufferBarData } from '@/lib/buffer-utils'

interface BufferBarProps {
  project: Project
  tasks: Task[]
  projectStartDate: Date
  pixelsPerDay?: number
  className?: string
}

export default function BufferBar({
  project,
  tasks,
  projectStartDate,
  pixelsPerDay = 50,
  className = ''
}: BufferBarProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  // Calcular informações do buffer
  const bufferInfo = calculateProjectBuffer(project, tasks)
  const bufferBarData = generateBufferBarData(bufferInfo, projectStartDate, pixelsPerDay)
  const statusFormat = formatBufferStatus(bufferInfo)

  // Se não há buffer configurado, não renderizar
  if (!project.buffer_days || project.buffer_days === 0) {
    return null
  }

  return (
    <div className={`relative ${className}`}>
      {/* Barra de Buffer */}
      <div
        className={`
          absolute top-0 h-8 border-2 border-dashed rounded-md cursor-pointer
          transition-all duration-200 hover:shadow-lg hover:scale-105
          ${bufferBarData.bufferBarColor}
          ${bufferBarData.bufferBarPattern}
        `}
        style={{
          left: `${bufferBarData.bufferBarLeft}px`,
          width: `${bufferBarData.bufferBarWidth}px`,
          minWidth: '20px' // Garantir visibilidade mínima
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Ícone de status no centro da barra */}
        <div className="flex items-center justify-center h-full">
          <span className="text-lg" title={statusFormat.message}>
            {statusFormat.icon}
          </span>
        </div>

        {/* Label da barra */}
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 whitespace-nowrap">
          Buffer: {project.buffer_days}d
        </div>
      </div>

      {/* Tooltip detalhado */}
      {showTooltip && (
        <div
          className="absolute z-50 p-4 bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{
            left: `${bufferBarData.bufferBarLeft + bufferBarData.bufferBarWidth / 2}px`,
            top: '-120px',
            transform: 'translateX(-50%)',
            minWidth: '280px'
          }}
        >
          {/* Seta do tooltip */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200"></div>

          {/* Conteúdo do tooltip */}
          <div className="space-y-3">
            {/* Título */}
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Clock className="w-4 h-4 text-blue-600" />
              Buffer de Proteção
            </div>

            {/* Status principal */}
            <div className={`
              flex items-center gap-2 p-2 rounded-md
              ${statusFormat.color === 'green' ? 'bg-green-50 text-green-800' : ''}
              ${statusFormat.color === 'yellow' ? 'bg-yellow-50 text-yellow-800' : ''}
              ${statusFormat.color === 'red' ? 'bg-red-50 text-red-800' : ''}
            `}>
              <span className="text-sm">{statusFormat.icon}</span>
              <span className="text-sm font-medium">{statusFormat.message}</span>
            </div>

            {/* Detalhes das datas */}
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Fim real:
                </span>
                <span className="font-medium">
                  {bufferInfo.realEndDate.toLocaleDateString('pt-BR')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Com buffer:
                </span>
                <span className="font-medium">
                  {bufferInfo.bufferEndDate.toLocaleDateString('pt-BR')}
                </span>
              </div>

              {bufferInfo.targetEndDate && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Data alvo:
                  </span>
                  <span className="font-medium">
                    {bufferInfo.targetEndDate.toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>

            {/* Estatísticas do buffer */}
            <div className="border-t border-gray-200 pt-2 space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Buffer configurado:</span>
                <span>{project.buffer_days} dias</span>
              </div>
              <div className="flex justify-between">
                <span>Buffer usado:</span>
                <span>{bufferInfo.bufferDaysUsed} dias</span>
              </div>
              <div className="flex justify-between">
                <span>Buffer restante:</span>
                <span className={bufferInfo.bufferDaysRemaining < 0 ? 'text-red-600 font-medium' : ''}>
                  {bufferInfo.bufferDaysRemaining} dias
                </span>
              </div>
            </div>

            {/* Alerta se buffer excedido */}
            {bufferInfo.bufferStatus === 'exceeded' && (
              <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-medium">Buffer Excedido!</div>
                  <div>O projeto está {Math.abs(bufferInfo.bufferDaysRemaining)} dias além do buffer planejado.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de indicador de status para header da página
export function BufferStatusIndicator({
  project,
  tasks
}: {
  project: Project
  tasks: Task[]
}) {
  const bufferInfo = calculateProjectBuffer(project, tasks)
  const statusFormat = formatBufferStatus(bufferInfo)

  if (!project.buffer_days || project.buffer_days === 0) {
    return null
  }

  return (
    <div className={`
      inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
      ${statusFormat.color === 'green' ? 'bg-green-100 text-green-800' : ''}
      ${statusFormat.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : ''}
      ${statusFormat.color === 'red' ? 'bg-red-100 text-red-800' : ''}
      ${statusFormat.color === 'gray' ? 'bg-gray-100 text-gray-800' : ''}
    `}>
      <span>{statusFormat.icon}</span>
      <span>
        {bufferInfo.bufferStatus === 'safe' && `${bufferInfo.bufferDaysRemaining}d restantes`}
        {bufferInfo.bufferStatus === 'consumed' && 'Buffer esgotado'}
        {bufferInfo.bufferStatus === 'exceeded' && `${Math.abs(bufferInfo.bufferDaysRemaining)}d em atraso`}
      </span>
    </div>
  )
}
