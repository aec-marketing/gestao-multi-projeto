'use client'

import { useState, useMemo } from 'react'
import { Resource } from '@/types/database.types'
import { PRIORITY_CONFIG } from '@/types/allocation.types'
import { formatDateBR } from '@/utils/date.utils'
import { useActiveResources, useAllocations, usePersonalEvents } from '@/hooks/useResources'
import { useResourceContext } from '@/contexts/ResourceContext'

interface ResourceManagerProps {
  onClose: () => void
}

export default function ResourceManager({ onClose }: ResourceManagerProps) {
  const { resources, isLoading: resourcesLoading } = useActiveResources()
  const { allocations, isLoading: allocationsLoading } = useAllocations()
  const { personalEvents, isLoading: eventsLoading } = usePersonalEvents()

  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)

  const isLoading = resourcesLoading || allocationsLoading || eventsLoading

  // Get allocations count per resource
  const resourceAllocationCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allocations.forEach(alloc => {
      counts[alloc.resource_id] = (counts[alloc.resource_id] || 0) + 1
    })
    return counts
  }, [allocations])

  // Group resources by role
  const groupedResources = useMemo(() => {
    const groups = {
      gerente: resources.filter(r => r.role === 'gerente'),
      lider: resources.filter(r => r.role === 'lider'),
      operador: resources.filter(r => r.role === 'operador')
    }
    return groups
  }, [resources])

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Carregando recursos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              👥 Gestão de Recursos
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {resources.length} recursos • {allocations.length} alocações ativas • {personalEvents.length} eventos pessoais
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
            title="Fechar"
          >
            ×
          </button>
        </div>

        {/* Main Content - Dual Panel with Independent Scrolls */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Resource List (Independent Scroll) */}
          <div className="w-80 border-r flex flex-col bg-gray-50">
            <div className="p-4 border-b bg-white flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Equipe</h3>
              <p className="text-xs text-gray-600 mt-1">Selecione para ver detalhes</p>
            </div>

            {/* Scrollable Resource List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Gerentes */}
              {groupedResources.gerente.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Gerentes
                  </div>
                  <div className="space-y-2">
                    {groupedResources.gerente.map(resource => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        allocationCount={resourceAllocationCounts[resource.id] || 0}
                        isSelected={selectedResourceId === resource.id}
                        onClick={() => setSelectedResourceId(resource.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Líderes */}
              {groupedResources.lider.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Líderes
                  </div>
                  <div className="space-y-2">
                    {groupedResources.lider.map(resource => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        allocationCount={resourceAllocationCounts[resource.id] || 0}
                        isSelected={selectedResourceId === resource.id}
                        onClick={() => setSelectedResourceId(resource.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Operadores */}
              {groupedResources.operador.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Operadores
                  </div>
                  <div className="space-y-2">
                    {groupedResources.operador.map(resource => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        allocationCount={resourceAllocationCounts[resource.id] || 0}
                        isSelected={selectedResourceId === resource.id}
                        onClick={() => setSelectedResourceId(resource.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Resource Details (Independent Scroll) */}
          <div className="flex-1 flex flex-col">
            {selectedResourceId ? (
              <ResourceDetailsPanel
                resourceId={selectedResourceId}
                resources={resources}
                allocations={allocations}
                personalEvents={personalEvents}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-8xl mb-4">👤</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Selecione um Recurso
                  </h3>
                  <p className="text-gray-600 max-w-sm">
                    Clique em um recurso na lista ao lado para ver suas alocações, eventos pessoais e análise detalhada
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Resource Card Component
function ResourceCard({
  resource,
  allocationCount,
  isSelected,
  onClick
}: {
  resource: Resource
  allocationCount: number
  isSelected: boolean
  onClick: () => void
}) {
  const roleIcons = {
    gerente: '👔',
    lider: '👨‍💼',
    operador: '👷'
  }

  const roleColors = {
    gerente: 'text-purple-600',
    lider: 'text-blue-600',
    operador: 'text-green-600'
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`text-2xl ${roleColors[resource.role]}`}>
          {roleIcons[resource.role]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {resource.name}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
            <span className="capitalize">{resource.role}</span>
            {allocationCount > 0 && (
              <>
                <span>•</span>
                <span className={allocationCount > 3 ? 'text-orange-600 font-medium' : ''}>
                  {allocationCount} {allocationCount === 1 ? 'tarefa' : 'tarefas'}
                </span>
              </>
            )}
          </div>
        </div>
        {isSelected && (
          <div className="text-blue-500">
            ▶
          </div>
        )}
      </div>
    </button>
  )
}

// Resource Details Panel Component
function ResourceDetailsPanel({
  resourceId,
  resources,
  allocations,
  personalEvents
}: {
  resourceId: string
  resources: Resource[]
  allocations: any[]
  personalEvents: any[]
}) {
  const resource = resources.find(r => r.id === resourceId)
  const resourceAllocations = allocations.filter(a => a.resource_id === resourceId)
  const resourceEvents = personalEvents.filter(e => e.resource_id === resourceId)

  if (!resource) return null

  const roleIcons = {
    gerente: '👔',
    lider: '👨‍💼',
    operador: '👷'
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Resource Header */}
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-3xl text-white">
            {roleIcons[resource.role]}
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900">{resource.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
              <span className="capitalize font-medium">{resource.role}</span>
              {resource.email && (
                <>
                  <span>•</span>
                  <span>{resource.email}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="px-3 py-1 bg-white rounded-full text-sm border">
                <span className="font-semibold text-gray-900">{resourceAllocations.length}</span>
                <span className="text-gray-600 ml-1">
                  {resourceAllocations.length === 1 ? 'tarefa alocada' : 'tarefas alocadas'}
                </span>
              </div>
              {resourceEvents.length > 0 && (
                <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm border border-purple-200">
                  <span className="font-semibold">{resourceEvents.length}</span>
                  <span className="ml-1">
                    {resourceEvents.length === 1 ? 'evento pessoal' : 'eventos pessoais'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Allocations Section */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>📊</span>
            <span>Tarefas Alocadas</span>
            <span className="text-sm font-normal text-gray-500">({resourceAllocations.length})</span>
          </h4>

          {resourceAllocations.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-gray-600">Nenhuma tarefa alocada no momento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resourceAllocations.map(allocation => (
                <AllocationCard key={allocation.id} allocation={allocation} />
              ))}
            </div>
          )}
        </div>

        {/* Personal Events Section */}
        {resourceEvents.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>📅</span>
              <span>Eventos Pessoais</span>
              <span className="text-sm font-normal text-gray-500">({resourceEvents.length})</span>
            </h4>

            <div className="space-y-3">
              {resourceEvents.map(event => (
                <PersonalEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>📈</span>
            <span>Estatísticas Rápidas</span>
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-700">{resourceAllocations.length}</div>
              <div className="text-sm text-blue-600 font-medium mt-1">Total de Tarefas</div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
              <div className="text-3xl font-bold text-red-700">
                {resourceAllocations.filter((a: any) => a.priority === 'alta').length}
              </div>
              <div className="text-sm text-red-600 font-medium mt-1">Alta Prioridade</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="text-3xl font-bold text-purple-700">{resourceEvents.length}</div>
              <div className="text-sm text-purple-600 font-medium mt-1">Eventos Pessoais</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-700">
                {resourceEvents.filter(e => e.blocks_work).length}
              </div>
              <div className="text-sm text-green-600 font-medium mt-1">Eventos Bloqueantes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Allocation Card Component
function AllocationCard({ allocation }: { allocation: any }) {
  const task = allocation.task
  const project = task?.project
  const priority = (allocation.priority || 'media') as 'alta' | 'media' | 'baixa'

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Project Info */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Projeto:</span>
        <span className="text-sm font-medium text-gray-700">{project?.name || 'Projeto não encontrado'}</span>
      </div>

      {/* Task Name */}
      <div className="font-semibold text-gray-900 mb-2">{task?.name || 'Tarefa não encontrada'}</div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Priority */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Prioridade</div>
          <span className={`inline-block px-2 py-1 text-xs rounded-full ${PRIORITY_CONFIG[priority].color}`}>
            {PRIORITY_CONFIG[priority].label}
          </span>
        </div>

        {/* Dates */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Período</div>
          <div className="text-xs text-gray-700">
            {allocation.start_date ? formatDateBR(allocation.start_date) : '—'} até{' '}
            {allocation.end_date ? formatDateBR(allocation.end_date) : '—'}
          </div>
        </div>
      </div>

      {/* Task Status (if available) */}
      {task?.status && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-xs text-gray-500">Status da Tarefa</div>
          <div className="text-sm font-medium text-gray-700 capitalize mt-1">
            {task.status.replace('_', ' ')}
          </div>
        </div>
      )}
    </div>
  )
}

// Personal Event Card Component
function PersonalEventCard({ event }: { event: any }) {
  const eventTypeLabels: Record<string, string> = {
    medico: '🏥 Médico',
    ferias: '🏖️ Férias',
    treinamento: '📚 Treinamento',
    licenca: '📋 Licença',
    feriado: '🎉 Feriado',
    outro: '📌 Outro'
  }

  return (
    <div className={`border-2 rounded-lg p-4 ${
      event.blocks_work
        ? 'bg-red-50 border-red-300'
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="font-semibold text-gray-900">{event.title}</div>
        {event.blocks_work && (
          <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-medium">
            Bloqueia trabalho
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">
          {eventTypeLabels[event.event_type] || event.event_type}
        </span>
      </div>

      <div className="text-sm text-gray-700">
        <span className="font-medium">Período:</span>{' '}
        {formatDateBR(event.start_date)} até {formatDateBR(event.end_date)}
      </div>

      {event.notes && (
        <div className="mt-2 pt-2 border-t border-gray-300">
          <div className="text-xs text-gray-500 mb-1">Observações</div>
          <div className="text-sm text-gray-700">{event.notes}</div>
        </div>
      )}

      {event.is_all_day && (
        <div className="mt-2 text-xs text-gray-600">
          🕐 Dia inteiro
        </div>
      )}
    </div>
  )
}
