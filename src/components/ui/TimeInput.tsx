'use client'

import { useState, useEffect, useRef } from 'react'
import {
  formatMinutes,
  validateTimeInput,
  getTimeInputPlaceholder,
  MINUTES_PER_WORKING_DAY
} from '@/utils/time.utils'

interface TimeInputProps {
  value: number // em minutos
  onChange: (minutes: number) => void
  workType?: 'work' | 'wait' | 'milestone'
  disabled?: boolean
  required?: boolean
  className?: string
  placeholder?: string
  autoFocus?: boolean
  onBlur?: () => void
  onEnter?: () => void
}

/**
 * Input inteligente para tempo
 *
 * Aceita formatos:
 * - "2h" → 120 minutos
 * - "30m" → 30 minutos
 * - "1.5d" → 810 minutos
 * - "2d 3h" → 1260 minutos
 * - "90" → 90 minutos
 *
 * Exibe valor formatado quando não está em foco.
 */
export function TimeInput({
  value,
  onChange,
  workType = 'work',
  disabled = false,
  required = false,
  className = '',
  placeholder,
  autoFocus = false,
  onBlur,
  onEnter
}: TimeInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewMinutes, setPreviewMinutes] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Atualizar display quando valor externo muda
  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatMinutes(value, 'short'))
    }
  }, [value, isFocused])

  // Auto-focus se solicitado
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleFocus = () => {
    setIsFocused(true)
    // Ao focar, mostrar valor em formato editável
    // Se é um número redondo de dias, mostrar em dias
    if (value % MINUTES_PER_WORKING_DAY === 0) {
      setInputValue(`${value / MINUTES_PER_WORKING_DAY}d`)
    } else {
      setInputValue(formatMinutes(value, 'short'))
    }
    // Selecionar todo o texto para facilitar edição
    setTimeout(() => {
      inputRef.current?.select()
    }, 0)
  }

  const handleBlur = () => {
    setIsFocused(false)
    setPreviewMinutes(null) // Limpar preview ao perder foco

    // Parsear e validar valor
    const validation = validateTimeInput(inputValue)

    if (!validation.valid) {
      setError(validation.error || 'Valor inválido')
      // Reverter para valor anterior
      setInputValue(formatMinutes(value, 'short'))
      setTimeout(() => setError(null), 3000)
    } else if (validation.minutes !== undefined) {
      // Validar para o tipo de trabalho
      if (workType === 'milestone' && validation.minutes !== 0) {
        setError('Marcos devem ter duração zero')
        setInputValue(formatMinutes(value, 'short'))
        setTimeout(() => setError(null), 3000)
      } else if (workType !== 'milestone' && validation.minutes === 0) {
        setError('Duração deve ser maior que zero')
        setInputValue(formatMinutes(value, 'short'))
        setTimeout(() => setError(null), 3000)
      } else {
        // Valor válido
        onChange(validation.minutes)
        setInputValue(formatMinutes(validation.minutes, 'short'))
        setError(null)
      }
    }

    onBlur?.()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setError(null)

    // Atualizar preview em tempo real
    const validation = validateTimeInput(newValue)
    if (validation.valid && validation.minutes !== undefined) {
      setPreviewMinutes(validation.minutes)
    } else {
      setPreviewMinutes(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
      onEnter?.()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      // Reverter para valor anterior
      setInputValue(formatMinutes(value, 'short'))
      setError(null)
      inputRef.current?.blur()
    }
  }

  const baseClassName = `
    w-full px-3 py-2
    border rounded-lg
    text-gray-900 bg-white
    transition-colors
    ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400'}
    focus:ring-2 focus:border-transparent
    ${className}
  `.trim()

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        required={required}
        placeholder={placeholder || getTimeInputPlaceholder()}
        className={baseClassName}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Texto de ajuda FIXO - sempre visível */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span>💡</span>
        <span>Exemplos:</span>
        <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">2h</code>
        <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">1.5d</code>
        <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">30m</code>
        <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">2h 30m</code>
      </div>

      {/* Preview DINÂMICO - só quando input válido */}
      {previewMinutes !== null && previewMinutes > 0 && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <code className="font-mono font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
              {inputValue}
            </code>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700 font-medium">{previewMinutes} min</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700 font-medium">{formatMinutes(previewMinutes, 'auto')}</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700 font-medium">{formatMinutes(previewMinutes, 'short')}</span>
          </div>
        </div>
      )}

      {/* Hint flutuante (hover/focus) - REMOVIDO - agora temos preview fixo */}

      {/* Mensagem de erro */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}

/**
 * Versão simplificada do TimeInput para uso inline (tabelas)
 * Sem exemplos/preview para não ocupar espaço
 */
export function TimeInputInline({
  value,
  onChange,
  workType = 'work',
  disabled = false,
  onBlur,
  onEnter
}: Omit<TimeInputProps, 'className' | 'placeholder' | 'required'>) {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Atualizar display quando valor externo muda
  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatMinutes(value, 'short'))
    }
  }, [value, isFocused])

  const handleFocus = () => {
    setIsFocused(true)
    if (value % MINUTES_PER_WORKING_DAY === 0) {
      setInputValue(`${value / MINUTES_PER_WORKING_DAY}d`)
    } else {
      setInputValue(formatMinutes(value, 'short'))
    }
    setTimeout(() => {
      inputRef.current?.select()
    }, 0)
  }

  const handleBlur = () => {
    setIsFocused(false)
    const validation = validateTimeInput(inputValue)

    if (!validation.valid) {
      setError(validation.error || 'Valor inválido')
      setInputValue(formatMinutes(value, 'short'))
      setTimeout(() => setError(null), 3000)
    } else if (validation.minutes !== undefined) {
      if (workType === 'milestone' && validation.minutes !== 0) {
        setError('Marcos devem ter duração zero')
        setInputValue(formatMinutes(value, 'short'))
        setTimeout(() => setError(null), 3000)
      } else if (workType !== 'milestone' && validation.minutes === 0) {
        setError('Duração deve ser maior que zero')
        setInputValue(formatMinutes(value, 'short'))
        setTimeout(() => setError(null), 3000)
      } else {
        onChange(validation.minutes)
        setInputValue(formatMinutes(validation.minutes, 'short'))
        setError(null)
      }
    }

    onBlur?.()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
      onEnter?.()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setInputValue(formatMinutes(value, 'short'))
      setError(null)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={getTimeInputPlaceholder()}
        className={`
          w-full px-2 py-1 text-sm
          border rounded
          text-gray-900
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400'}
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
        `}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Mensagem de erro compacta */}
      {error && (
        <div className="absolute left-0 top-full mt-1 z-10 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 shadow-sm whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  )
}

/**
 * Display somente leitura de duração (sem input)
 */
interface TimeDisplayProps {
  value: number // em minutos
  format?: 'auto' | 'short' | 'long'
  className?: string
}

export function TimeDisplay({ value, format = 'auto', className = '' }: TimeDisplayProps) {
  return (
    <span className={`text-gray-900 ${className}`}>
      {formatMinutes(value, format)}
    </span>
  )
}
