import React, { useState, useEffect } from 'react'

interface TaskEditCellProps {
  value: any
  type: 'text' | 'number' | 'date'
  onBlur: (value: any) => void
  hasPendingChange: boolean
  placeholder?: string
  min?: number
  step?: number
  disabled?: boolean
  className?: string
}

/**
 * Componente de célula editável (controlled)
 *
 * CRÍTICO: Resolve o bug de campos resetando ao editar
 * - Usa controlled component (value + onChange)
 * - useEffect sincroniza com valor externo (após save)
 * - Estado local melhora performance durante digitação
 */
export const TaskEditCell = React.memo(function TaskEditCell({
  value,
  type,
  onBlur,
  hasPendingChange,
  placeholder,
  min,
  step,
  disabled = false,
  className = ''
}: TaskEditCellProps) {
  // Estado local para o valor sendo editado
  const [localValue, setLocalValue] = useState(value)

  // Sincronizar com valor externo quando mudar (após save)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleBlur = () => {
    onBlur(localValue)
  }

  // Classes base com destaque para pending changes
  const baseClasses = `px-2 py-1 border rounded text-sm transition-all ${
    hasPendingChange
      ? 'bg-yellow-50 border-yellow-400 border-2 ring-1 ring-yellow-300'
      : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`

  if (type === 'text') {
    return (
      <input
        type="text"
        value={localValue || ''}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onDoubleClick={(e) => e.currentTarget.select()}
        placeholder={placeholder}
        disabled={disabled}
        className={`${baseClasses} flex-1 text-gray-900`}
      />
    )
  }

  if (type === 'number') {
    return (
      <input
        type="number"
        value={localValue || ''}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onDoubleClick={(e) => e.currentTarget.select()}
        placeholder={placeholder}
        min={min}
        step={step}
        disabled={disabled}
        className={`${baseClasses} w-20 text-center text-gray-900`}
      />
    )
  }

  if (type === 'date') {
    return (
      <input
        type="date"
        value={localValue || ''}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        className={`${baseClasses} text-gray-900`}
      />
    )
  }

  return null
})
