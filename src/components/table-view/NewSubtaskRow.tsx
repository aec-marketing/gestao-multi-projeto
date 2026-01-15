/**
 * Linha inline para criar nova subtarefa
 */

import React from 'react'

interface NewSubtaskRowProps {
  name: string
  duration: number
  parentLevel: number
  onNameChange: (value: string) => void
  onDurationChange: (value: number) => void
  onSave: () => void
  onCancel: () => void
  isSaving?: boolean
}

export function NewSubtaskRow({
  name,
  duration,
  parentLevel,
  onNameChange,
  onDurationChange,
  onSave,
  onCancel,
  isSaving = false
}: NewSubtaskRowProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  // Indentação para mostrar que é subtarefa
  const indent = (parentLevel + 1) * 30

  return (
    <tr className="bg-blue-50 border-2 border-blue-400">
      {/* WBS (vazio) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400">-</td>

      {/* Nome / Tarefa com indentação */}
      <td className="px-4 py-2">
        <div className="flex items-center gap-2" style={{ paddingLeft: `${indent}px` }}>
          <span className="text-gray-400">└─</span>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nome da subtarefa..."
            className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
            disabled={isSaving}
          />
        </div>
      </td>

      {/* Tipo (fixo como subtarefa) */}
      <td className="px-4 py-2">
        <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
          Subtarefa
        </span>
      </td>

      {/* Duração */}
      <td className="px-4 py-2">
        <input
          type="number"
          value={duration}
          onChange={(e) => onDurationChange(parseFloat(e.target.value) || 1)}
          onKeyDown={handleKeyDown}
          step="0.125"
          min="0.125"
          className="w-20 px-2 py-1 border border-blue-300 rounded text-sm text-gray-900 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isSaving}
        />
      </td>

      {/* Início (será herdado do pai) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400 italic">Herda do pai</td>

      {/* Fim (calculado automaticamente) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400 italic">Auto</td>

      {/* Pessoas (vazio) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400">-</td>

      {/* Progresso (vazio) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400">0%</td>

      {/* Custo Estimado (vazio) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400">-</td>

      {/* Custo Real (vazio) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400">-</td>

      {/* Ações */}
      <td className="px-4 py-2">
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={onSave}
            disabled={isSaving || !name.trim()}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  )
}
