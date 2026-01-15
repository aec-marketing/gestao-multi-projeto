/**
 * Linha inline para criar nova tarefa
 */

import React from 'react'

interface NewTaskRowProps {
  name: string
  type: string
  duration: number
  onNameChange: (value: string) => void
  onTypeChange: (value: string) => void
  onDurationChange: (value: number) => void
  onSave: () => void
  onCancel: () => void
  isSaving?: boolean
}

export function NewTaskRow({
  name,
  type,
  duration,
  onNameChange,
  onTypeChange,
  onDurationChange,
  onSave,
  onCancel,
  isSaving = false
}: NewTaskRowProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <tr className="bg-green-50 border-2 border-green-400">
      {/* WBS (vazio) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400">-</td>

      {/* Nome / Tarefa */}
      <td className="px-4 py-2">
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nome da tarefa..."
          className="w-full px-2 py-1 border border-green-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          autoFocus
          disabled={isSaving}
        />
      </td>

      {/* Tipo */}
      <td className="px-4 py-2">
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 border border-green-300 rounded text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          disabled={isSaving}
        >
          <option value="projeto_mecanico">Projeto Mecânico</option>
          <option value="compras_mecanica">Compras Mecânica</option>
          <option value="projeto_eletrico">Projeto Elétrico</option>
          <option value="compras_eletrica">Compras Elétrica</option>
          <option value="fabricacao">Fabricação</option>
          <option value="tratamento_superficial">Tratamento Superficial</option>
          <option value="montagem_mecanica">Montagem Mecânica</option>
          <option value="montagem_eletrica">Montagem Elétrica</option>
          <option value="coleta">Coleta</option>
        </select>
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
          className="w-20 px-2 py-1 border border-green-300 rounded text-sm text-gray-900 text-center focus:ring-2 focus:ring-green-500 focus:border-green-500"
          disabled={isSaving}
        />
      </td>

      {/* Início (vazio) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400">-</td>

      {/* Fim (vazio) */}
      <td className="px-4 py-2 text-center text-sm text-gray-400">-</td>

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
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
