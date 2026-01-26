/**
 * Linha inline para criar nova tarefa
 * ONDA 2: Atualizado para usar TimeInput e minutos
 */

import React from 'react'
import { TimeInputInline } from '@/components/ui/TimeInput'
import { WorkTypeSelect } from '@/components/ui/WorkTypeSelect'
import { WorkType } from '@/utils/workType.utils'

interface NewTaskRowProps {
  name: string
  type: string
  workType: WorkType  // ONDA 3: Categoria (Produção/Dependência/Checkpoint)
  duration: number  // ONDA 2: Agora em MINUTOS (não mais dias)
  onNameChange: (value: string) => void
  onTypeChange: (value: string) => void
  onWorkTypeChange: (value: WorkType) => void  // ONDA 3
  onDurationChange: (minutes: number) => void  // ONDA 2: Recebe minutos
  onSave: () => void
  onCancel: () => void
  isSaving?: boolean
}

export function NewTaskRow({
  name,
  type,
  workType,
  duration,
  onNameChange,
  onTypeChange,
  onWorkTypeChange,
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

      {/* Categoria (Work Type) - ONDA 3 */}
      <td className="px-4 py-2">
        <WorkTypeSelect
          value={workType}
          onChange={(newWorkType) => {
            onWorkTypeChange(newWorkType)
            // Se mudar para Checkpoint, forçar duration = 0
            if (newWorkType === 'milestone') {
              onDurationChange(0)
            }
          }}
          disabled={isSaving}
          className="w-full border-green-300 focus:ring-green-500 focus:border-green-500"
        />
      </td>

      {/* Duração - ONDA 2: TimeInput / ONDA 2.5: Input separado para Wait */}
      <td className="px-4 py-2">
        {workType === 'wait' ? (
          // Input específico para WAIT (dias corridos)
          <div className="w-28">
            <input
              type="number"
              step="0.5"
              min="0"
              value={duration > 0 ? Math.round((duration / 1440) * 10) / 10 : ''}
              onChange={(e) => {
                const days = parseFloat(e.target.value) || 0
                onDurationChange(days * 1440) // Converter para minutos (24h × 60min)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ex: 7"
              className="w-full px-2 py-1 border border-green-300 rounded text-sm text-gray-900 text-right focus:ring-2 focus:ring-green-500 focus:border-green-500"
              disabled={isSaving}
              title="Dias corridos (inclui fins de semana)"
            />
            <div className="text-[10px] text-gray-500 mt-0.5 text-center">
              dias corridos
            </div>
          </div>
        ) : (
          // Input padrão para WORK e MILESTONE
          <div className="w-28">
            <TimeInputInline
              value={duration}
              onChange={onDurationChange}
              disabled={isSaving || workType === 'milestone'}
              onEnter={onSave}
            />
          </div>
        )}
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
