/**
 * Célula especializada para edição de duração
 * ONDA 2: Usa TimeInput para entrada inteligente
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TimeInputInline, TimeDisplay } from '@/components/ui/TimeInput'
import { formatMinutes } from '@/utils/time.utils'
import { dispatchToast } from '@/components/ui/ToastProvider'

interface TaskDurationCellProps {
  value: number  // duration_minutes
  onBlur: (minutes: number) => void
  hasPendingChange: boolean
  disabled?: boolean
  workType?: 'work' | 'wait' | 'milestone'
  isReadOnly?: boolean  // Para tarefas pai (sum of children)
}

/**
 * Célula editável de duração com TimeInput
 *
 * Comportamento:
 * - Click único: exibe valor formatado (ex: "1.5d")
 * - Double click: ativa edição com TimeInput
 * - isReadOnly: apenas display (tarefas pai)
 */
export const TaskDurationCell = React.memo(function TaskDurationCell({
  value,
  onBlur,
  hasPendingChange,
  disabled = false,
  workType = 'work',
  isReadOnly = false
}: TaskDurationCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [tooltipArrow, setTooltipArrow] = useState<'top' | 'bottom'>('top')
  const cellRef = React.useRef<HTMLDivElement>(null)

  // Sincronizar com valor externo
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Calcular posição fixed para o tooltip (evita clipping por overflow ou stacking context)
  const handleMouseEnter = () => {
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect()
      const spaceAbove = rect.top
      const showAbove = spaceAbove > 160

      if (showAbove) {
        setTooltipStyle({
          position: 'fixed',
          bottom: window.innerHeight - rect.top + 8,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
        })
        setTooltipArrow('bottom')
      } else {
        setTooltipStyle({
          position: 'fixed',
          top: rect.bottom + 8,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
        })
        setTooltipArrow('top')
      }
      setTooltipVisible(true)
    }
  }

  const handleMouseLeave = () => {
    setTooltipVisible(false)
  }

  const handleDoubleClick = () => {
    // Checkpoints (milestones) não podem ter duração editada
    if (workType === 'milestone') {
      dispatchToast('Checkpoints têm duração zero e não podem ser editados', 'info')
      return
    }

    if (!disabled && !isReadOnly) {
      setIsEditing(true)
    }
  }

  const handleChange = (minutes: number) => {
    setLocalValue(minutes)
  }

  const handleBlur = () => {
    setIsEditing(false)
    // Só notificar mudança se o valor realmente mudou
    if (localValue !== value) {
      onBlur(localValue)
    }
  }

  const handleEnter = () => {
    setIsEditing(false)
    if (localValue !== value) {
      onBlur(localValue)
    }
  }

  // Classes base
  const baseClasses = `
    px-2 py-1 rounded text-sm transition-all text-center
    ${hasPendingChange
      ? 'bg-yellow-50 border-2 border-yellow-400 ring-1 ring-yellow-300'
      : 'border border-transparent'
    }
    ${disabled || isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100'}
  `.trim()

  // Modo CHECKPOINT (milestone) - sempre 0
  if (workType === 'milestone') {
    return (
      <div
        className={`${baseClasses} bg-green-50 cursor-default text-green-700`}
        title="Checkpoints têm duração zero"
      >
        <span className="text-xs">🎯 0d</span>
      </div>
    )
  }

  // Modo READ-ONLY (tarefas pai)
  if (isReadOnly) {
    return (
      <div
        className={`${baseClasses} bg-gray-50 cursor-default text-gray-600 italic`}
        title="Duração calculada automaticamente pela soma das subtarefas"
      >
        <TimeDisplay value={value} format="short" workType={workType} />
        <span className="text-xs ml-1 text-gray-400">∑</span>
      </div>
    )
  }

  // Modo EDITING
  if (isEditing) {
    // Input específico para WAIT (dias corridos)
    if (workType === 'wait') {
      return (
        <div className="w-28 mx-auto">
          <input
            type="number"
            step="0.5"
            min="0"
            value={localValue > 0 ? Math.round((localValue / 1440) * 10) / 10 : ''}
            onChange={(e) => {
              const days = parseFloat(e.target.value) || 0
              handleChange(days * 1440) // Converter para minutos (24h × 60min)
            }}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEnter()
              if (e.key === 'Escape') setIsEditing(false)
            }}
            placeholder="Ex: 7"
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled}
            title="Dias corridos (inclui fins de semana)"
            autoFocus
          />
          <div className="text-[10px] text-yellow-600 mt-0.5 text-center font-mono">
            dias corridos (24h/dia)
          </div>
        </div>
      )
    }

    // Input padrão para WORK e MILESTONE
    return (
      <div className="w-28 mx-auto">
        <TimeInputInline
          value={localValue}
          onChange={handleChange}
          workType={workType}
          disabled={disabled}
          onBlur={handleBlur}
          onEnter={handleEnter}
          autoFocus
        />
      </div>
    )
  }

  // Tooltip renderizado via portal para escapar de qualquer stacking context da tabela
  const tooltip = tooltipVisible ? createPortal(
    <div
      style={{ ...tooltipStyle, zIndex: 99999 }}
      className="bg-gray-900 text-white text-xs rounded-lg px-4 py-3 shadow-2xl whitespace-nowrap pointer-events-none"
    >
      <div className="space-y-1">
        <p className="font-semibold text-blue-300">Detalhes da duração:</p>
        <p>• {value} minutos</p>
        <p>• {formatMinutes(value, 'auto', workType)}</p>
        <p>• {formatMinutes(value, 'long', workType)}</p>
        {!isReadOnly && (
          <p className="text-gray-400 text-xs mt-2 border-t border-gray-700 pt-1">
            Clique duplo para editar
          </p>
        )}
      </div>
      {/* Seta adaptativa */}
      {tooltipArrow === 'bottom' ? (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
      ) : (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mb-1" />
      )}
    </div>,
    document.body
  ) : null

  // Modo DISPLAY (double-click para editar)
  return (
    <div ref={cellRef} className="relative">
      <div
        className={baseClasses}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <TimeDisplay value={value} format="short" workType={workType} />
      </div>
      {tooltip}
    </div>
  )
})
