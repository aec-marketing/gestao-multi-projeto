'use client'

import { useState } from 'react'
import { parseLocalDate } from '@/utils/date.utils'
import { PersonalEventWithResource } from '@/types/personal-events.types'
import PersonalEventBadge from '@/components/calendar/PersonalEventBadge'
import ConflictIndicator from '@/components/calendar/ConflictIndicator'

interface Project {
  id: string
  code: string
  name: string
}

interface CalendarEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  priority: 'alta' | 'media' | 'baixa'
  resourceId: string
  resourceName: string
  projectId: string
  projectName: string
  projectCode: string
  taskType: string
}

interface ProjectViewProps {
  days: Date[]
  events: CalendarEvent[]
  personalEvents: PersonalEventWithResource[]
  projects: Project[]
  onDayClick: (date: Date, projectId: string) => void
  onTaskClick?: (event: CalendarEvent) => void
}

export default function ProjectView({
  days,
  events,
  personalEvents,
  projects,
  onDayClick,
  onTaskClick
}: ProjectViewProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string | null>(null)

  function toggleProject(projectId: string) {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  function getEventsForProjectAndDay(projectCode: string, date: Date): CalendarEvent[] {
    return events.filter(event => {
      if (event.projectCode !== projectCode) return false

      const eventStart = new Date(event.startDate)
      const eventEnd = new Date(event.endDate)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

      return eventStart <= dayEnd && eventEnd >= dayStart
    })
  }

  function getPersonalEventsForDay(date: Date, projectEvents: CalendarEvent[]): PersonalEventWithResource[] {
    // Pegar recursos únicos que têm tarefas neste projeto neste dia
    const resourceIds = new Set(projectEvents.map(e => e.resourceId))
    
    return personalEvents.filter(event => {
      if (!resourceIds.has(event.resource_id)) return false

      const eventStart = parseLocalDate(event.start_date)
      const eventEnd = parseLocalDate(event.end_date)

      if (!eventStart || !eventEnd) return false

      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

      return eventStart <= dayEnd && eventEnd >= dayStart
    })
  }

  function hasConflictForProject(projectCode: string, date: Date): boolean {
    const projectEventsOnDay = getEventsForProjectAndDay(projectCode, date)
    if (projectEventsOnDay.length === 0) return false

    const personalEventsOnDay = getPersonalEventsForDay(date, projectEventsOnDay)
    return personalEventsOnDay.some(e => e.blocks_work)
  }

  function getProjectProgress(projectCode: string): number {
    const projectEvents = events.filter(e => e.projectCode === projectCode)
    if (projectEvents.length === 0) return 0

    // Calcular progresso baseado em tarefas concluídas
    // (Aqui assumimos que as tarefas têm um campo de progresso, ajustar conforme necessário)
    return Math.round(Math.random() * 100) // Placeholder - integrar com dados reais
  }

  // Filtrar apenas projetos que têm tarefas nesta semana
  const projectsWithTasks = projects.filter(project => {
    const projectEventsInWeek = events.filter(e => e.projectCode === project.code)
    return projectEventsInWeek.length > 0
  })

  // Ordenar por quantidade de tarefas (decrescente)
  const sortedProjects = [...projectsWithTasks].sort((a, b) => {
    const aTaskCount = events.filter(e => e.projectCode === a.code).length
    const bTaskCount = events.filter(e => e.projectCode === b.code).length
    return bTaskCount - aTaskCount
  })

  // Filtrar projetos se houver filtro selecionado
  const displayedProjects = selectedProjectFilter
    ? sortedProjects.filter(p => p.id === selectedProjectFilter)
    : sortedProjects

  return (
    <div className="h-full flex flex-col">
      {/* Barra de filtro de projeto */}
      {sortedProjects.length > 1 && (
        <div className="bg-white border-b p-4 flex items-center space-x-4 sticky top-0 z-30 shadow-sm">
          <label className="text-sm font-medium text-gray-700">Filtrar projeto:</label>
          <select
            value={selectedProjectFilter || ''}
            onChange={(e) => setSelectedProjectFilter(e.target.value || null)}
            className="px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os projetos ({sortedProjects.length})</option>
            {sortedProjects.map(project => (
              <option key={project.id} value={project.id}>
                {project.code} - {project.name}
              </option>
            ))}
          </select>
          {selectedProjectFilter && (
            <button
              onClick={() => setSelectedProjectFilter(null)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ✕ Limpar filtro
            </button>
          )}
        </div>
      )}

      {/* Linhas dos projetos com calendário integrado */}
      <div className="flex-1 overflow-auto">
        {displayedProjects.map(project => {
          const isExpanded = expandedProjects.has(project.id)
          const projectProgress = getProjectProgress(project.code)
          
          // Contar tarefas do projeto na semana
          const projectEventsInWeek = events.filter(e => e.projectCode === project.code)
          const uniqueResources = new Set(projectEventsInWeek.map(e => e.resourceName))

          return (
            <div key={project.id} className="mb-6 bg-white rounded-lg shadow-sm border-2 border-gray-200 overflow-hidden">
              {/* Header do Projeto */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleProject(project.id)}
                      className="text-white hover:text-blue-100 transition-colors"
                      title={isExpanded ? 'Recolher detalhes' : 'Ver detalhes das tarefas'}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <div>
                      <h3 className="font-bold text-xl">{project.code}</h3>
                      <p className="text-blue-100 text-sm">{project.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center space-x-2">
                      <span>👥</span>
                      <span className="font-semibold">{uniqueResources.size}</span>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center space-x-2">
                      <span>📋</span>
                      <span className="font-semibold">{projectEventsInWeek.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grade de dias com informações integradas */}
              <div className="grid grid-cols-7 gap-2 p-4 bg-gray-50">
                
                {days.map((day, dayIndex) => {
                  const dayEvents = getEventsForProjectAndDay(project.code, day)
                  const hasConflict = hasConflictForProject(project.code, day)
                  const personalEventsOnDay = getPersonalEventsForDay(day, dayEvents)
                  const uniquePeopleOnDay = new Set(dayEvents.map(e => e.resourceName))
                  const isToday = day.toDateString() === new Date().toDateString()

                  // Cor de fundo baseada no status
                  let bgColor = 'bg-white'
                  let borderColor = 'border-gray-300'
                  let badgeColor = 'bg-gray-600'

                  if (hasConflict) {
                    bgColor = 'bg-red-50'
                    borderColor = 'border-red-400'
                    badgeColor = 'bg-red-600'
                  } else if (dayEvents.length >= 3) {
                    bgColor = 'bg-blue-50'
                    borderColor = 'border-blue-400'
                    badgeColor = 'bg-blue-600'
                  } else if (dayEvents.length > 0) {
                    bgColor = 'bg-green-50'
                    borderColor = 'border-green-400'
                    badgeColor = 'bg-green-600'
                  }

                  if (isToday) {
                    borderColor = 'border-yellow-400 ring-2 ring-yellow-300'
                  }

                  return (
                    <div
                      key={dayIndex}
                      className={`rounded-lg border-2 ${borderColor} ${bgColor} p-3 min-h-[140px] cursor-pointer hover:shadow-lg transition-all ${isToday ? 'ring-2 ring-yellow-300' : ''}`}
                      onClick={() => onDayClick(day, project.id)}
                      title={`Clique para ver detalhes do projeto neste dia`}
                    >
                      {/* Header do dia - SEMPRE VISÍVEL */}
                      <div className="mb-3 pb-2 border-b border-gray-300">
                        <div className="text-xs font-semibold text-gray-600 uppercase">
                          {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-bold ${isToday ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {day.getDate()}/{day.getMonth() + 1}
                        </div>
                      </div>

                      {/* Conteúdo do dia */}
                      {dayEvents.length > 0 ? (
                        <div className="space-y-2">
                          {/* Badge de tarefas */}
                          <div className={`inline-flex items-center justify-center px-3 py-2 rounded-lg text-white font-bold shadow-md ${badgeColor}`}>
                            <span className="text-lg">{dayEvents.length}</span>
                            <span className="ml-1 text-xs">
                              {dayEvents.length === 1 ? 'tarefa' : 'tarefas'}
                            </span>
                          </div>

                          {/* Badge de pessoas */}
                          {uniquePeopleOnDay.size > 0 && (
                            <div className="text-xs bg-white px-2 py-1 rounded border border-gray-300 text-gray-700 font-medium inline-flex items-center">
                              👥 {uniquePeopleOnDay.size}
                            </div>
                          )}

                          {/* Indicador de conflito */}
                          {hasConflict && (
                            <div className="text-xs text-red-700 font-bold bg-red-100 px-2 py-1 rounded border border-red-400 animate-pulse">
                              ⚠️ Conflito
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-gray-400 text-sm py-4">
                          Sem tarefas
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Detalhes Expandidos - com dias integrados */}
              {isExpanded && (
                <div className="bg-white border-t-2 border-blue-300 p-4">
                  <div className="mb-3 text-sm font-semibold text-blue-800 flex items-center">
                    <span className="mr-2">📋</span>
                    Detalhes das Tarefas por Dia
                  </div>
                  <div className="grid grid-cols-7 gap-3">
                    {days.map((day, dayIndex) => {
                      const dayEvents = getEventsForProjectAndDay(project.code, day)

                      return (
                        <div key={dayIndex} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          {/* Header do dia repetido */}
                          <div className="mb-2 pb-2 border-b border-gray-300">
                            <div className="text-xs font-semibold text-gray-600">
                              {day.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()}
                            </div>
                            <div className="text-sm font-bold text-gray-900">
                              {day.getDate()}/{day.getMonth() + 1}
                            </div>
                          </div>

                          {/* Lista de tarefas */}
                          <div className="space-y-2">
                            {dayEvents.length > 0 ? (
                              dayEvents.map((event, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs p-2 bg-white rounded border border-gray-300 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onTaskClick?.(event)
                                  }}
                                  title={`Clique para ver mais detalhes`}
                                >
                                  <div className="flex items-center space-x-1 mb-1">
                                    <span className="text-[10px]">👤</span>
                                    <div className="font-bold text-gray-900 truncate text-[11px]">
                                      {event.resourceName}
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-gray-700 truncate mb-1.5 leading-tight">
                                    {event.title}
                                  </div>
                                  <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block ${
                                    event.priority === 'alta' ? 'bg-red-100 text-red-700' :
                                    event.priority === 'media' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>
                                    {event.priority.toUpperCase()}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center text-gray-400 text-xs py-3">
                                Sem tarefas
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mensagem se não houver projetos */}
      {sortedProjects.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-6xl mb-4">📂</div>
          <p className="text-lg font-medium text-gray-700">Nenhum projeto com tarefas neste período</p>
          <p className="text-sm text-gray-500 mt-2">As tarefas aparecerão aqui quando forem alocadas</p>
        </div>
      )}
    </div>
  )
}