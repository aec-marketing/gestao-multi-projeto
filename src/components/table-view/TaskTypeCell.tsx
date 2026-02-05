/**
 * Célula editável para tipo de tarefa
 * Permite alterar o tipo (projeto_mecanico, fabricacao, etc.) inline
 */

import React, { useState } from 'react'
import { formatTaskType, getTaskColorClass } from './utils'

type TaskType =
  | 'projeto_mecanico'
  | 'compras_mecanica'
  | 'projeto_eletrico'
  | 'compras_eletrica'
  | 'fabricacao'
  | 'tratamento_superficial'
  | 'montagem_mecanica'
  | 'montagem_eletrica'
  | 'coleta'
  | 'subtarefa'

interface TaskTypeCellProps {
  value: TaskType
  onChange: (value: TaskType) => void
  disabled?: boolean
  hasPendingChange?: boolean
}

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'projeto_mecanico', label: 'Projeto Mecânico' },
  { value: 'compras_mecanica', label: 'Compras Mecânica' },
  { value: 'projeto_eletrico', label: 'Projeto Elétrico' },
  { value: 'compras_eletrica', label: 'Compras Elétrica' },
  { value: 'fabricacao', label: 'Fabricação' },
  { value: 'tratamento_superficial', label: 'Tratamento Superficial' },
  { value: 'montagem_mecanica', label: 'Montagem Mecânica' },
  { value: 'montagem_eletrica', label: 'Montagem Elétrica' },
  { value: 'coleta', label: 'Coleta' },
  { value: 'subtarefa', label: 'Subtarefa' }
]

export function TaskTypeCell({
  value,
  onChange,
  disabled = false,
  hasPendingChange = false
}: TaskTypeCellProps) {
  const [isEditing, setIsEditing] = useState(false)

  if (disabled) {
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${getTaskColorClass(value)}`}>
        {formatTaskType(value)}
      </span>
    )
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className={`
          px-2 py-1 rounded text-xs font-medium
          hover:ring-2 hover:ring-blue-300 transition-all
          ${getTaskColorClass(value)}
          ${hasPendingChange ? 'ring-2 ring-yellow-400' : ''}
        `}
        title="Clique para editar o tipo"
      >
        {formatTaskType(value)}
      </button>
    )
  }

  return (
    <div onBlur={() => setIsEditing(false)} className="relative">
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value as TaskType)
          setIsEditing(false)
        }}
        autoFocus
        className="
          px-2 py-1 rounded text-xs font-medium
          border-2 border-blue-500
          focus:outline-none focus:ring-2 focus:ring-blue-500
          bg-white text-gray-900
        "
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsEditing(false)
          }
        }}
      >
        {TASK_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="text-gray-900 bg-white">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
