/**
 * WorkTypeSelect - Dropdown para selecionar tipo de tarefa
 *
 * Exibe opções amigáveis:
 * - Produção (work)
 * - Dependência (wait)
 * - Checkpoint (milestone)
 */

import React from 'react'
import { WorkType, WORK_TYPE_OPTIONS, getWorkTypeIcon, getWorkTypeLabel } from '@/utils/workType.utils'

interface WorkTypeSelectProps {
  value: WorkType
  onChange: (value: WorkType) => void
  disabled?: boolean
  className?: string
}

export function WorkTypeSelect({
  value,
  onChange,
  disabled = false,
  className = ''
}: WorkTypeSelectProps) {
  return (
    <div className="space-y-1.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as WorkType)}
        disabled={disabled}
        className={`
          px-2 py-1
          border border-gray-300 rounded
          text-sm text-gray-900
          bg-white
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${className}
        `}
      >
        {WORK_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="text-gray-900 bg-white">
            {option.icon} {option.label}
          </option>
        ))}
      </select>

      {/* Card informativo baseado no tipo selecionado */}
      {value === 'work' && (
        <div className="bg-blue-50 border-l-4 border-blue-500 px-4 py-3 rounded-r text-sm">
          <p className="font-semibold text-blue-800 mb-1">🔧 Produção</p>
          <p className="text-gray-700 leading-relaxed">
            Consome recursos e capacidade. Duração em dias <strong>úteis</strong> (9h/dia, seg-sex).
            <br />
            <span className="text-gray-500 text-xs mt-1 block">
              Ex: Montagem, Fabricação, Programação, Testes
            </span>
          </p>
        </div>
      )}

      {value === 'wait' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 px-4 py-3 rounded-r text-sm">
          <p className="font-semibold text-yellow-800 mb-1">⏳ Dependência</p>
          <p className="text-gray-700 leading-relaxed">
            Não consome recursos. Duração em dias <strong>corridos</strong> (24h/dia, inclui fins de semana).
            <br />
            <span className="text-gray-500 text-xs mt-1 block">
              Ex: Aguardar fornecedor, cura de concreto, transporte, aprovação externa
            </span>
          </p>
        </div>
      )}

      {value === 'milestone' && (
        <div className="bg-green-50 border-l-4 border-green-500 px-4 py-3 rounded-r text-sm">
          <p className="font-semibold text-green-800 mb-1">🎯 Checkpoint</p>
          <p className="text-gray-700 leading-relaxed">
            Duração zero. Apenas marca uma data importante no cronograma.
            <br />
            <span className="text-gray-500 text-xs mt-1 block">
              Ex: Entrega ao cliente, início de fase, revisão de projeto, aprovação
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * WorkTypeDisplay - Apenas exibição (não editável)
 */
interface WorkTypeDisplayProps {
  value: WorkType
  showIcon?: boolean
  className?: string
}

export function WorkTypeDisplay({
  value,
  showIcon = true,
  className = ''
}: WorkTypeDisplayProps) {
  const icon = getWorkTypeIcon(value)
  const label = getWorkTypeLabel(value)

  return (
    <span className={`inline-flex items-center gap-1 text-gray-900 ${className}`}>
      {showIcon && <span>{icon}</span>}
      <span>{label}</span>
    </span>
  )
}

/**
 * WorkTypeCell - Célula para uso em tabelas (inline edit)
 */
interface WorkTypeCellProps {
  value: WorkType
  onChange: (value: WorkType) => void
  disabled?: boolean
}

export function WorkTypeCell({
  value,
  onChange,
  disabled = false
}: WorkTypeCellProps) {
  const [isEditing, setIsEditing] = React.useState(false)

  if (disabled) {
    return <WorkTypeDisplay value={value} />
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="
          w-full text-left px-2 py-1
          hover:bg-gray-100 rounded
          transition-colors
        "
      >
        <WorkTypeDisplay value={value} />
      </button>
    )
  }

  return (
    <div onBlur={() => setIsEditing(false)}>
      <WorkTypeSelect
        value={value}
        onChange={(newValue) => {
          onChange(newValue)
          setIsEditing(false)
        }}
        className="w-full"
      />
    </div>
  )
}
