'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Resource, Task } from '@/types/database.types'
import { Allocation, PRIORITY_CONFIG } from '@/types/allocation.types'
import { formatDateBR } from '@/utils/date.utils'
import { showErrorAlert, showSuccessAlert, logError, ErrorContext } from '@/utils/errorHandler'
import { useActiveResources, useAllocations } from '@/hooks/useResources'
import { useResourceContext } from '@/contexts/ResourceContext'
import { checkResourceAvailability, ResourceConflict } from '@/lib/resource-service'

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
  // ✅ Use global resources from context
  const { resources: allResources, isLoading: resourcesLoading } = useActiveResources()
  const { allocations: allAllocations } = useAllocations()
  const { refreshAllocations } = useResourceContext()

  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<'lider' | 'operador'>('lider')
  const [priority, setPriority] = useState<'alta' | 'media' | 'baixa'>('media')
  const [isSaving, setIsSaving] = useState(false)
  const [conflicts, setConflicts] = useState<ResourceConflict[]>([])
  const [showConflictWarning, setShowConflictWarning] = useState(false)
  const [allowOverride, setAllowOverride] = useState(false)
  const [conflictingPriorities, setConflictingPriorities] = useState<string[]>([])

  // Filter allocations for this specific task
  const existingAllocations = allAllocations.filter(a => a.task_id === task.id)
  const isLoading = resourcesLoading

  async function handleAllocate() {
    if (!selectedResourceId) {
      alert('Selecione uma pessoa')
      return
    }

    // Check for task dates
    if (!task.start_date || !task.end_date) {
      alert('Esta tarefa não possui datas definidas')
      return
    }

    setIsSaving(true)
    setConflicts([])
    setShowConflictWarning(false)

    try {
      // ✅ Check for conflicts before allocating
      const availabilityCheck = await checkResourceAvailability(
        selectedResourceId,
        task.start_date,
        task.end_date
      )

      if (!availabilityCheck.isAvailable) {
        // Extract priorities from conflicting allocations
        const allocationConflicts = availabilityCheck.conflicts.filter(c => c.type === 'allocation_overlap')
        const priorities = allocationConflicts
          .map(c => {
            const conflictAlloc = allAllocations.find(a => a.id === (c.details as any)?.allocationId)
            return conflictAlloc?.priority
          })
          .filter(Boolean) as string[]

        setConflicts(availabilityCheck.conflicts)
        setConflictingPriorities(priorities)
        setShowConflictWarning(true)
        setIsSaving(false)

        // Check if override is allowed (only for allocation overlaps, not personal events)
        const hasPersonalEventBlock = availabilityCheck.conflicts.some(c => c.type === 'personal_event_block')
        setAllowOverride(!hasPersonalEventBlock && allocationConflicts.length > 0)

        return
      }

      // Create allocation
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

      showSuccessAlert('Recurso alocado com sucesso!')

      // Reset form
      setSelectedResourceId('')
      setPriority('media')
      setConflicts([])
      setShowConflictWarning(false)

      // Refresh global allocations
      await refreshAllocations()
      onSuccess()
    } catch (error: any) {
      if (error.code === '23505') {
        alert('Esta pessoa já está alocada nesta tarefa')
      } else {
        logError(error, 'handleAllocate')
        showErrorAlert(error, ErrorContext.ALLOCATION_CREATE)
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleForceAllocate() {
    // Force allocation even with conflicts (only for allocation overlaps)
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

      showSuccessAlert('Recurso alocado com prioridade diferenciada!')

      // Reset form
      setSelectedResourceId('')
      setPriority('media')
      setConflicts([])
      setConflictingPriorities([])
      setShowConflictWarning(false)
      setAllowOverride(false)

      // Refresh global allocations
      await refreshAllocations()
      onSuccess()
    } catch (error: any) {
      if (error.code === '23505') {
        alert('Esta pessoa já está alocada nesta tarefa')
      } else {
        logError(error, 'handleForceAllocate')
        showErrorAlert(error, ErrorContext.ALLOCATION_CREATE)
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

      showSuccessAlert('Alocação removida com sucesso')

      // Refresh global allocations
      await refreshAllocations()
      onSuccess()
    } catch (error) {
      logError(error, 'removeAllocation')
      showErrorAlert(error, ErrorContext.ALLOCATION_DELETE)
    }
  }

  // Separar recursos por papel
  const allocatedResourceIds = existingAllocations.map(a => a.resource_id)

  // Líderes alocados na tarefa atual
  const allocatedLeaders = existingAllocations
    .map(a => allResources.find(r => r.id === a.resource_id))
    .filter(r => r && (r.hierarchy === 'lider' || r.hierarchy === 'gerente'))
    .filter(Boolean) as Resource[]

  // ✅ HERANÇA DE LÍDERES: Se esta é uma subtarefa, buscar líderes da tarefa pai
  const parentTaskLeaders = useMemo(() => {
    if (!task.parent_id) return []

    // Buscar alocações da tarefa pai
    const parentAllocations = allAllocations.filter(a => a.task_id === task.parent_id)

    // Extrair líderes alocados na tarefa pai
    return parentAllocations
      .map(a => allResources.find(r => r.id === a.resource_id))
      .filter(r => r && (r.hierarchy === 'lider' || r.hierarchy === 'gerente'))
      .filter(Boolean) as Resource[]
  }, [task.parent_id, allAllocations, allResources])

  // Combinar líderes da tarefa atual + líderes herdados da tarefa pai (sem duplicatas)
  const allEffectiveLeaders = useMemo(() => {
    const combined = [...allocatedLeaders, ...parentTaskLeaders]
    const uniqueLeaderIds = new Set(combined.map(l => l.id))
    return Array.from(uniqueLeaderIds).map(id => combined.find(l => l.id === id)!).filter(Boolean)
  }, [allocatedLeaders, parentTaskLeaders])

  // IDs dos líderes efetivos (incluindo herdados)
  const allocatedLeaderIds = allEffectiveLeaders.map(l => l.id)

  // Líderes disponíveis (não alocados ainda)
  const availableLeaders = allResources.filter(r =>
    (r.hierarchy === 'lider' || r.hierarchy === 'gerente') &&
    !allocatedResourceIds.includes(r.id)
  )

  // Operadores dos líderes alocados
  const operatorsOfAllocatedLeaders = allResources.filter(r =>
    r.hierarchy === 'operador' &&
    r.leader_id &&
    allocatedLeaderIds.includes(r.leader_id) &&
    !allocatedResourceIds.includes(r.id)
  )

  // Agrupar operadores por líder (usar líderes efetivos, incluindo herdados)
  const operatorsByLeader = allEffectiveLeaders.map(leader => ({
    leader,
    operators: operatorsOfAllocatedLeaders.filter(op => op.leader_id === leader.id),
    isInherited: parentTaskLeaders.some(pl => pl.id === leader.id) && !allocatedLeaders.some(al => al.id === leader.id)
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
                              {resource.hierarchy === 'gerente' ? '👔 Gerente' :
                               resource.hierarchy === 'lider' ? '👨‍💼 Líder' :
                               '👷 Operador'}
                              {resource.role && ` - ${resource.role}`}
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

              {/* Info sobre líderes herdados */}
              {parentTaskLeaders.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  ℹ️ Esta subtarefa herda {parentTaskLeaders.length} {parentTaskLeaders.length === 1 ? 'líder' : 'líderes'} da tarefa pai.
                  Você pode alocar operadores desses líderes sem precisar alocá-los novamente.
                </div>
              )}

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
                    disabled={allEffectiveLeaders.length === 0}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedRole === 'operador'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : allEffectiveLeaders.length === 0
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">👷 Operador</div>
                    <div className="text-xs mt-1 opacity-80">
                      {allEffectiveLeaders.length === 0
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
                              {resource.name} {resource.hierarchy === 'gerente' ? '(Gerente)' : '(Líder)'}{resource.role ? ` - ${resource.role}` : ''}
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
                      {operatorsByLeader.map(({ leader, operators, isInherited }) => (
                        operators.length > 0 && (
                          <div key={leader.id} className={`border rounded-lg p-3 ${isInherited ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                              <span>👨‍💼 Equipe de {leader.name}</span>
                              {isInherited && (
                                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full" title="Líder alocado na tarefa pai">
                                  Herdado da tarefa pai
                                </span>
                              )}
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

              {/* ✅ Conflict Warning */}
              {showConflictWarning && conflicts.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-red-600 text-xl">⚠️</span>
                    <div className="flex-1">
                      <h5 className="font-bold text-red-900 mb-1">
                        {allowOverride ? 'Conflito Detectado - Priorização Necessária' : 'Conflito Detectado - Não foi possível alocar'}
                      </h5>
                      <p className="text-sm text-red-800 mb-3">
                        {allowOverride
                          ? 'Este recurso já está alocado em outra(s) tarefa(s) no mesmo período:'
                          : 'Este recurso não está disponível no período da tarefa:'
                        }
                      </p>
                      <div className="space-y-2">
                        {conflicts.map((conflict, idx) => (
                          <div key={idx} className="bg-white p-2 rounded border border-red-200 text-sm text-red-900">
                            <div className="font-medium">
                              {conflict.type === 'allocation_overlap' && '📊 Já alocado em outra tarefa'}
                              {conflict.type === 'personal_event_block' && '🚫 Evento pessoal bloqueante'}
                            </div>
                            <div className="text-red-700 mt-1">{conflict.message}</div>
                          </div>
                        ))}
                      </div>

                      {/* Override Option */}
                      {allowOverride && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                          <div className="text-sm text-yellow-900 font-medium mb-2">
                            💡 Você pode alocar com prioridade diferente
                          </div>
                          <p className="text-xs text-yellow-800 mb-3">
                            As tarefas conflitantes têm prioridade: {conflictingPriorities.map(p => PRIORITY_CONFIG[p as 'alta' | 'media' | 'baixa']?.label || p).join(', ')}.
                            Escolha uma prioridade diferente para criar hierarquia entre as tarefas.
                          </p>

                          {/* Priority Selection for Override */}
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-yellow-900">
                              Selecione a prioridade desta alocação:
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['alta', 'media', 'baixa'] as const).map(p => {
                                const isConflicting = conflictingPriorities.includes(p)
                                const isDisabled = isConflicting

                                return (
                                  <button
                                    key={p}
                                    onClick={() => !isDisabled && setPriority(p)}
                                    disabled={isDisabled}
                                    className={`p-2 rounded-lg border-2 text-xs transition-all ${
                                      isDisabled
                                        ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                                        : priority === p
                                        ? `${PRIORITY_CONFIG[p].color} border-current`
                                        : 'border-gray-300 hover:border-gray-400 text-gray-700 bg-white'
                                    }`}
                                  >
                                    <div className="font-medium">
                                      {PRIORITY_CONFIG[p].label}
                                    </div>
                                    {isConflicting && (
                                      <div className="text-xs mt-0.5 text-red-600">
                                        ✗ Já em uso
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Override Action Buttons */}
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={handleForceAllocate}
                              disabled={conflictingPriorities.includes(priority) || isSaving}
                              className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm rounded font-medium hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                              {isSaving ? 'Alocando...' : '✓ Alocar com Prioridade Diferente'}
                            </button>
                            <button
                              onClick={() => {
                                setShowConflictWarning(false)
                                setConflicts([])
                                setConflictingPriorities([])
                                setAllowOverride(false)
                                setSelectedResourceId('')
                              }}
                              className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Cancel button for non-overridable conflicts */}
                      {!allowOverride && (
                        <button
                          onClick={() => {
                            setShowConflictWarning(false)
                            setConflicts([])
                            setConflictingPriorities([])
                            setSelectedResourceId('')
                          }}
                          className="mt-3 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                        >
                          Escolher outro recurso
                        </button>
                      )}
                    </div>
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