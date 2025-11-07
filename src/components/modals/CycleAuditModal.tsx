'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { detectCycles, findAllCycles, suggestCycleBreakers, type CycleDetectionResult } from '@/lib/msproject/validation'

interface CycleAuditModalProps {
  projectId: string
  tasks: Array<{ id: string; name: string }>
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
}

export default function CycleAuditModal({
  projectId,
  tasks,
  isOpen,
  onClose,
  onRefresh
}: CycleAuditModalProps) {
  const [scanning, setScanning] = useState(false)
  const [cycles, setCycles] = useState<CycleDetectionResult[]>([])
  const [predecessors, setPredecessors] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])

  useEffect(() => {
    if (isOpen) {
      scanForCycles()
    }
  }, [isOpen])

  async function scanForCycles() {
    setScanning(true)

    try {
      // Buscar predecessores do projeto
      const taskIds = tasks.map(t => t.id)
      const { data: preds, error } = await supabase
        .from('predecessors')
        .select('*')
        .in('task_id', taskIds)

      if (error) throw error

      setPredecessors(preds || [])

      // Detectar ciclos
      const detectedCycles = findAllCycles(tasks, preds || [])
      setCycles(detectedCycles)

      // Se houver ciclos, gerar sugestões
      if (detectedCycles.length > 0) {
        const allSuggestions = detectedCycles.flatMap(cycle =>
          suggestCycleBreakers(cycle.cycleNodes, preds || [])
        )
        setSuggestions(allSuggestions)
      }

    } catch (error) {
      alert('Erro ao escanear ciclos')
    } finally {
      setScanning(false)
    }
  }

  async function breakCycle(predecessorId: string) {
    if (!confirm('Tem certeza que deseja remover este predecessor para quebrar o ciclo?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('predecessors')
        .delete()
        .eq('id', predecessorId)

      if (error) throw error

      alert('✅ Predecessor removido com sucesso!')
      onRefresh()
      scanForCycles() // Re-escanear
    } catch (error) {
      alert('Erro ao remover predecessor')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔄</span>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Auditoria de Ciclos
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Detectar e corrigir dependências circulares
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {scanning ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Escaneando predecessores...</p>
            </div>
          ) : cycles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <h4 className="text-xl font-bold text-green-700 mb-2">
                Nenhum Ciclo Detectado!
              </h4>
              <p className="text-gray-600 text-center max-w-md">
                Todos os predecessores estão corretos e não há dependências circulares.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumo */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">⚠️</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-lg mb-1">
                      {cycles.length} Ciclo{cycles.length > 1 ? 's' : ''} Detectado{cycles.length > 1 ? 's' : ''}!
                    </h4>
                    <p className="text-sm text-gray-700">
                      Dependências circulares impedem o cálculo correto de datas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de Ciclos */}
              {cycles.map((cycle, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
                  <h5 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm">
                      Ciclo #{index + 1}
                    </span>
                  </h5>

                  {/* Caminho do Ciclo */}
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm font-medium text-red-900 mb-2">
                      Caminho do ciclo:
                    </p>
                    <p className="text-sm text-red-700 font-mono">
                      {cycle.cyclePath.join(' → ')}
                    </p>
                  </div>

                  {/* Sugestões de Correção */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      💡 Sugestões para quebrar o ciclo:
                    </p>
                    <div className="space-y-2">
                      {suggestions
                        .filter(s => cycle.cycleNodes.includes(s.task_id) || cycle.cycleNodes.includes(s.predecessor_id))
                        .map((suggestion, idx) => {
                          const task = tasks.find(t => t.id === suggestion.task_id)
                          const pred = tasks.find(t => t.id === suggestion.predecessor_id)

                          return (
                            <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors">
                              <div className="flex-1">
                                <p className="text-sm text-gray-900 font-medium">
                                  {task?.name || 'Tarefa'}
                                  <span className="text-gray-500 mx-2">→ depende de →</span>
                                  {pred?.name || 'Predecessor'}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {suggestion.reason}
                                </p>
                              </div>
                              <button
                                onClick={() => breakCycle(suggestion.id)}
                                className="ml-4 px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center gap-1"
                              >
                                🗑️ Remover
                              </button>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={scanForCycles}
            disabled={scanning}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            🔄 Re-escanear
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}