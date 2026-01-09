'use client'

import { useMemo } from 'react'
import { CalendarEvent } from '@/types/allocation.types'
import { PersonalEvent, EVENT_TYPE_CONFIG } from '@/types/personal-events.types'
import { formatDateBR } from '@/utils/date.utils'

interface DayDetailModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date | null
  eventsByResource: Map<string, CalendarEvent[]>
  personalEventsByResource: Map<string, PersonalEvent[]>
  totalResources: number
  allResources?: Array<{ id: string; name: string }>
}

/**
 * Modal showing detailed information about a specific day
 * Shows tasks, team allocation, and personal events for that day
 */
export default function DayDetailModal({
  isOpen,
  onClose,
  date,
  eventsByResource,
  personalEventsByResource,
  totalResources,
  allResources = [],
}: DayDetailModalProps) {
  // Calculate day metrics
  const dayMetrics = useMemo(() => {
    if (!date) return null

    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

    const tasksOnDay: Array<CalendarEvent & { resourceName: string }> = []
    const resourcesWorking = new Set<string>()
    const projectsActive = new Set<string>()

    // Build resource name map from allResources list first (most reliable source)
    const resourceNameMap = new Map<string, string>()

    allResources.forEach(resource => {
      resourceNameMap.set(resource.id, resource.name)
    })

    // Also add from events in case there are resources not in allResources
    eventsByResource.forEach((events, resourceId) => {
      // Get resource name from first event for this resource if not already in map
      if (events.length > 0 && !resourceNameMap.has(resourceId)) {
        resourceNameMap.set(resourceId, events[0].resourceName)
      }

      // Now collect tasks for today
      events.forEach(event => {
        const eventStart = new Date(event.startDate)
        const eventEnd = new Date(event.endDate)

        if (eventStart <= dayEnd && eventEnd >= dayStart) {
          tasksOnDay.push(event)
          resourcesWorking.add(resourceId)
          projectsActive.add(event.projectCode)
        }
      })
    })

    // Collect personal events for this day with resource names
    const personalEventsOnDay: Array<PersonalEvent & { resourceName: string }> = []
    const resourcesBlocked = new Set<string>()

    personalEventsByResource.forEach((events, resourceId) => {
      events.forEach(event => {
        const eventStart = new Date(event.start_date)
        const eventEnd = new Date(event.end_date)

        if (eventStart <= dayEnd && eventEnd >= dayStart) {
          personalEventsOnDay.push({
            ...event,
            resourceName: resourceNameMap.get(resourceId) || `ID: ${resourceId}`
          })
          if (event.blocks_work) {
            resourcesBlocked.add(resourceId)
          }
        }
      })
    })

    // Group tasks by project
    const tasksByProject = tasksOnDay.reduce((acc, task) => {
      if (!acc[task.projectCode]) {
        acc[task.projectCode] = {
          projectCode: task.projectCode,
          projectName: task.projectName,
          tasks: [],
        }
      }
      acc[task.projectCode].tasks.push(task)
      return acc
    }, {} as Record<string, { projectCode: string; projectName: string; tasks: CalendarEvent[] }>)

    // Priority distribution
    const priorityCount = {
      alta: tasksOnDay.filter(t => t.priority === 'alta').length,
      media: tasksOnDay.filter(t => t.priority === 'media').length,
      baixa: tasksOnDay.filter(t => t.priority === 'baixa').length,
    }

    const availableResources = totalResources - resourcesBlocked.size
    const utilizationRate = availableResources > 0 ? (resourcesWorking.size / availableResources) * 100 : 0

    return {
      tasksOnDay,
      personalEventsOnDay,
      tasksByProject: Object.values(tasksByProject),
      resourcesWorking: resourcesWorking.size,
      resourcesBlocked: resourcesBlocked.size,
      availableResources,
      projectsActive: projectsActive.size,
      utilizationRate,
      priorityCount,
    }
  }, [date, eventsByResource, personalEventsByResource, totalResources])

  if (!isOpen || !date || !dayMetrics) return null

  const getUtilizationStatus = () => {
    const rate = dayMetrics.utilizationRate
    if (rate >= 80) return { label: 'Crítico', color: 'text-red-600', bgColor: 'bg-red-50' }
    if (rate >= 60) return { label: 'Alto', color: 'text-orange-600', bgColor: 'bg-orange-50' }
    if (rate >= 40) return { label: 'Médio', color: 'text-yellow-600', bgColor: 'bg-yellow-50' }
    return { label: 'Baixo', color: 'text-green-600', bgColor: 'bg-green-50' }
  }

  const utilizationStatus = getUtilizationStatus()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                📅 {formatDateBR(date)}
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Detalhes de alocação e disponibilidade
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-600 mb-1">Tarefas</div>
              <div className="text-3xl font-bold text-blue-900">{dayMetrics.tasksOnDay.length}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-600 mb-1">Projetos</div>
              <div className="text-3xl font-bold text-purple-900">{dayMetrics.projectsActive}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-600 mb-1">Recursos Ativos</div>
              <div className="text-3xl font-bold text-green-900">{dayMetrics.resourcesWorking}</div>
            </div>
            <div className={`${utilizationStatus.bgColor} border rounded-lg p-4 text-center`}>
              <div className="text-sm text-gray-600 mb-1">Utilização</div>
              <div className={`text-3xl font-bold ${utilizationStatus.color}`}>
                {dayMetrics.utilizationRate.toFixed(0)}%
              </div>
              <div className={`text-xs font-medium ${utilizationStatus.color}`}>
                {utilizationStatus.label}
              </div>
            </div>
          </div>

          {/* Priority distribution */}
          {(dayMetrics.priorityCount.alta > 0 || dayMetrics.priorityCount.media > 0 || dayMetrics.priorityCount.baixa > 0) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Distribuição de Prioridades</h3>
              <div className="flex gap-3">
                {dayMetrics.priorityCount.alta > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded text-sm">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="font-medium text-red-900">Alta: {dayMetrics.priorityCount.alta}</span>
                  </div>
                )}
                {dayMetrics.priorityCount.media > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 border border-yellow-300 rounded text-sm">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="font-medium text-yellow-900">Média: {dayMetrics.priorityCount.media}</span>
                  </div>
                )}
                {dayMetrics.priorityCount.baixa > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-100 border border-green-300 rounded text-sm">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-900">Baixa: {dayMetrics.priorityCount.baixa}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Personal events (if any) */}
          {dayMetrics.personalEventsOnDay.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>🗓️</span>
                <span>Eventos Pessoais ({dayMetrics.personalEventsOnDay.length})</span>
              </h3>
              <div className="space-y-2">
                {dayMetrics.personalEventsOnDay.map(event => {
                  const config = EVENT_TYPE_CONFIG[event.event_type]
                  return (
                    <div key={event.id} className={`${config.bgColor} ${config.borderColor} border-2 rounded p-3`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{config.icon}</span>
                          <div>
                            <div className={`font-medium ${config.color}`}>{event.title}</div>
                            <div className="text-xs text-gray-600 mt-0.5">👤 {event.resourceName}</div>
                          </div>
                        </div>
                        {event.blocks_work && (
                          <span className="px-2 py-1 bg-red-100 border border-red-300 text-red-800 text-xs rounded font-medium">
                            🚫 Bloqueia trabalho
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tasks by project */}
          {dayMetrics.tasksByProject.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Tarefas por Projeto</h3>
              {dayMetrics.tasksByProject.map(project => (
                <div key={project.projectCode} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-gray-900">{project.projectCode}</h4>
                      <p className="text-sm text-gray-600">{project.projectName}</p>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {project.tasks.length} {project.tasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {project.tasks.map(task => {
                      const priorityColors = {
                        alta: 'border-l-red-500 bg-red-50',
                        media: 'border-l-yellow-500 bg-yellow-50',
                        baixa: 'border-l-green-500 bg-green-50',
                      }
                      return (
                        <div
                          key={task.id}
                          className={`border-l-4 ${priorityColors[task.priority]} p-3 rounded`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{task.title}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                👤 {task.resourceName}
                              </div>
                            </div>
                            <span className={`
                              px-2 py-1 rounded text-xs font-medium
                              ${task.priority === 'alta' ? 'bg-red-200 text-red-900' : ''}
                              ${task.priority === 'media' ? 'bg-yellow-200 text-yellow-900' : ''}
                              ${task.priority === 'baixa' ? 'bg-green-200 text-green-900' : ''}
                            `}>
                              {task.priority === 'alta' ? '🔴 Alta' : task.priority === 'media' ? '🟡 Média' : '🟢 Baixa'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">📭</div>
              <div className="font-medium">Nenhuma tarefa agendada para este dia</div>
              <div className="text-sm mt-1">A equipe está livre para novos trabalhos</div>
            </div>
          )}

          {/* Resource availability */}
          {dayMetrics.resourcesBlocked > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <span>⚠️</span>
                <span>Recursos Indisponíveis</span>
              </h3>
              <p className="text-sm text-red-800">
                {dayMetrics.resourcesBlocked} {dayMetrics.resourcesBlocked === 1 ? 'recurso está' : 'recursos estão'} bloqueados
                por eventos pessoais neste dia.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
