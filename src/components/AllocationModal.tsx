'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Resource, Task } from '@/types/database.types'
import { Allocation, PRIORITY_CONFIG } from '@/types/allocation.types'
import { formatDateBR } from '@/utils/date.utils'

interface AllocationModalProps {
  task: Task
  projectLeaderId: string | null
  onClose: () => void
  onSuccess: () => void
}

export default function AllocationModal({ 
  task, 
  projectLeaderId, 
  onClose, 
  onSuccess 
}: AllocationModalProps) {
  const [allResources, setAllResources] = useState<Resource[]>([])
  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<'lider' | 'operador'>('lider')
  const [priority, setPriority] = useState<'alta' | 'media' | 'baixa'>('media')
  const [existingAllocations, setExistingAllocations] = useState<Allocation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [task.id])

  async function loadData() {
    setIsLoading(true)
    try {
      // Carregar TODOS os recursos ativos
      const { data: resourcesData } = await supabase
        .from('resources')
        .select('*')
        .eq('is_active', true)
        .order('role', { ascending: false }) // gerente > lider > operador
        .order('name', { ascending: true })

      // Carregar alocações existentes da tarefa
      const { data: allocationsData } = await supabase
        .from('allocations')
        .select('*')
        .eq('task_id', task.id)

      setAllResources(resourcesData || [])
      setExistingAllocations(allocationsData || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAllocate() {
    if (!selectedResourceId) {
      alert('Selecione uma pessoa')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('allocations')
        .insert({
          resource_id: selectedResourceId,
          task_id: task.id,
          priority: priority,
          start_date: task.start_date,
          end_date: task.end_date
        })

      if (error) throw error

      // Resetar formulário
      setSelectedResourceId('')
      setPriority('media')
      
      // Recarregar dados
      loadData()
      onSuccess()
    } catch (error: any) {
      console.error('Erro ao alocar recurso:', error)
      if (error.code === '23505') {
        alert('Esta pessoa já está alocada nesta tarefa')
      } else {
        alert('Erro ao alocar recurso')
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveAllocation(allocationId: string) {
    if (!confirm('Deseja remover esta alocação?')) return

    try {
      const { error } = await supabase
        .from('allocations')
        .delete()
        .eq('id', allocationId)

      if (error) throw error

      loadData()
      onSuccess()
    } catch (error) {
      console.error('Erro ao remover alocação:', error)
      alert('Erro ao remover alocação')
    }
  }

  // Separar recursos por papel
  const allocatedResourceIds = existingAllocations.map(a => a.resource_id)
  
  // Líderes alocados na tarefa
  const allocatedLeaders = existingAllocations
    .map(a => allResources.find(r => r.id === a.resource_id))
    .filter(r => r && (r.role === 'lider' || r.role === 'gerente'))
    .filter(Boolean) as Resource[]
  
  // IDs dos líderes alocados
  const allocatedLeaderIds = allocatedLeaders.map(l => l.id)

  // Líderes disponíveis (não alocados ainda)
  const availableLeaders = allResources.filter(r => 
    (r.role === 'lider' || r.role === 'gerente') && 
    !allocatedResourceIds.includes(r.id)
  )

  // Operadores dos líderes alocados
  const operatorsOfAllocatedLeaders = allResources.filter(r => 
    r.role === 'operador' && 
    r.leader_id && 
    allocatedLeaderIds.includes(r.leader_id) &&
    !allocatedResourceIds.includes(r.id)
  )

  // Agrupar operadores por líder
  const operatorsByLeader = allocatedLeaders.map(leader => ({
    leader,
    operators: operatorsOfAllocatedLeaders.filter(op => op.leader_id === leader.id)
  }))

  // Todas as alocações com detalhes dos recursos
  const allocationsWithResources = existingAllocations
    .map(allocation => ({
      ...allocation,
      resource: allResources.find(r => r.id === allocation.resource_id)
    }))
    .filter(a => a.resource)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              👥 Alocar Pessoa
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Tarefa: {task.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-600">
            Carregando...
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Alocações Existentes */}
            {allocationsWithResources.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">
                  Pessoas Alocadas ({allocationsWithResources.length})
                </h4>
                <div className="space-y-2">
                  {allocationsWithResources.map(allocation => {
                    const resource = allocation.resource!
                    return (
                      <div
                        key={allocation.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                            {resource.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{resource.name}</p>
                            <p className="text-xs text-gray-500">
                              {resource.role === 'gerente' ? '👔 Gerente' : 
                               resource.role === 'lider' ? '👨‍💼 Líder' : 
                               '👷 Operador'}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${PRIORITY_CONFIG[allocation.priority].color}`}>
                            {PRIORITY_CONFIG[allocation.priority].label}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveAllocation(allocation.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors ml-2"
                        >
                          Remover
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Nova Alocação */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Nova Alocação
              </h4>

              {/* Seleção de Tipo (Líder ou Operador) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Recurso
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setSelectedRole('lider')
                      setSelectedResourceId('')
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedRole === 'lider'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">👨‍💼 Líder / Gerente</div>
                    <div className="text-xs mt-1 opacity-80">
                      Alocar um líder ou gerente
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRole('operador')
                      setSelectedResourceId('')
                    }}
                    disabled={allocatedLeaders.length === 0}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedRole === 'operador'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : allocatedLeaders.length === 0
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">👷 Operador</div>
                    <div className="text-xs mt-1 opacity-80">
                      {allocatedLeaders.length === 0 
                        ? 'Aloque um líder primeiro'
                        : 'Alocar operador de um líder'
                      }
                    </div>
                  </button>
                </div>
              </div>

              {/* Seleção de Líder */}
              {selectedRole === 'lider' && (
                <div>
                  {availableLeaders.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                      ⚠️ Todos os líderes disponíveis já estão alocados nesta tarefa.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Selecionar Líder / Gerente
                        </label>
                        <select
                          value={selectedResourceId}
                          onChange={(e) => setSelectedResourceId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Escolha um líder...</option>
                          {availableLeaders.map(resource => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} {resource.role === 'gerente' ? '(Gerente)' : '(Líder)'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Seleção de Operador */}
              {selectedRole === 'operador' && (
                <div>
                  {operatorsOfAllocatedLeaders.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                      ⚠️ Não há operadores disponíveis dos líderes alocados.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Mostrar operadores agrupados por líder */}
                      {operatorsByLeader.map(({ leader, operators }) => (
                        operators.length > 0 && (
                          <div key={leader.id} className="border rounded-lg p-3 bg-gray-50">
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              👨‍💼 Equipe de {leader.name}
                            </div>
                            <div className="space-y-2">
                              {operators.map(operator => (
                                <label
                                  key={operator.id}
                                  className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                                    selectedResourceId === operator.id
                                      ? 'bg-blue-100 border-blue-300 border-2'
                                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="operator"
                                    value={operator.id}
                                    checked={selectedResourceId === operator.id}
                                    onChange={(e) => setSelectedResourceId(e.target.value)}
                                    className="mr-3"
                                  />
                                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium mr-2">
                                    {operator.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-gray-900 font-medium">{operator.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Seleção de Prioridade */}
              {selectedResourceId && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridade da Tarefa
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['alta', 'media', 'baixa'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          priority === p
                            ? `${PRIORITY_CONFIG[p].color} border-current`
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {PRIORITY_CONFIG[p].label}
                        </div>
                        <div className="text-xs mt-1 opacity-80">
                          {PRIORITY_CONFIG[p].description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Info sobre as datas */}
              {task.start_date && task.end_date && selectedResourceId && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  ℹ️ Esta alocação usará as datas da tarefa:
                  <div className="mt-1">
                    <strong>Início:</strong> {formatDateBR(task.start_date)} •
                    <strong> Fim:</strong> {formatDateBR(task.end_date)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAllocate}
            disabled={!selectedResourceId || isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Alocando...' : '✓ Alocar Pessoa'}
          </button>
        </div>
      </div>
    </div>
  )
}