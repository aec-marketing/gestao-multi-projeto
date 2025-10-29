'use client'

import { useState } from 'react'
import { Resource } from '@/types/database.types'
import { parseLocalDate } from '@/utils/date.utils'
import { PersonalEventWithResource } from '@/types/personal-events.types'
import PersonalEventBadge from '@/components/calendar/PersonalEventBadge'
import ConflictIndicator from '@/components/calendar/ConflictIndicator'

interface Leader {
  id: string
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

interface LeaderViewProps {
  days: Date[]
  events: CalendarEvent[]
  personalEvents: PersonalEventWithResource[]
  resources: Resource[]
  leaders: Leader[]
  onDayClick: (date: Date, resourceId: string) => void
  onEventClick?: (event: CalendarEvent) => void
}

export default function LeaderView({
  days,
  events,
  personalEvents,
  resources,
  leaders,
  onDayClick,
  onEventClick
}: LeaderViewProps) {
  const [expandedLeaders, setExpandedLeaders] = useState<Set<string>>(new Set())

  function toggleLeader(leaderId: string) {
    const newExpanded = new Set(expandedLeaders)
    if (newExpanded.has(leaderId)) {
      newExpanded.delete(leaderId)
    } else {
      newExpanded.add(leaderId)
    }
    setExpandedLeaders(newExpanded)
  }

  function getTeamMembers(leaderId: string): Resource[] {
    return resources.filter(r => r.leader_id === leaderId)
  }

  function getEventsForResourceAndDay(resourceId: string, date: Date): CalendarEvent[] {
    return events.filter(event => {
      if (event.resourceId !== resourceId) return false

      const eventStart = new Date(event.startDate)
      const eventEnd = new Date(event.endDate)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

      return eventStart <= dayEnd && eventEnd >= dayStart
    })
  }

  function getPersonalEventsForDay(date: Date, resourceId: string): PersonalEventWithResource[] {
    return personalEvents.filter(event => {
      if (event.resource_id !== resourceId) return false

      const eventStart = parseLocalDate(event.start_date)
      const eventEnd = parseLocalDate(event.end_date)

      if (!eventStart || !eventEnd) return false

      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

      return eventStart <= dayEnd && eventEnd >= dayStart
    })
  }

  function hasConflict(date: Date, resourceId: string): boolean {
    const dayEvents = getEventsForResourceAndDay(resourceId, date)
    const personalEventsOnDay = getPersonalEventsForDay(date, resourceId)
    const hasBlockingEvent = personalEventsOnDay.some(e => e.blocks_work)

    return dayEvents.length > 0 && hasBlockingEvent
  }

  function getTeamWorkload(leaderId: string, date: Date): {
    totalTasks: number
    totalConflicts: number
    totalAbsences: number
    activeMembers: number
  } {
    const team = getTeamMembers(leaderId)
    let totalTasks = 0
    let totalConflicts = 0
    let totalAbsences = 0
    let activeMembers = 0

    team.forEach(member => {
      const dayEvents = getEventsForResourceAndDay(member.id, date)
      const personalEventsOnDay = getPersonalEventsForDay(date, member.id)
      
      totalTasks += dayEvents.length
      if (hasConflict(date, member.id)) totalConflicts++
      if (personalEventsOnDay.some(e => e.blocks_work)) totalAbsences++
      if (dayEvents.length > 0) activeMembers++
    })

    return { totalTasks, totalConflicts, totalAbsences, activeMembers }
  }

  // Filtrar apenas líderes que têm membros com tarefas
  const leadersWithActiveTasks = leaders.filter(leader => {
    const team = getTeamMembers(leader.id)
    return team.some(member =>
      events.some(e => e.resourceId === member.id)
    )
  })

  // Ordenar por quantidade total de tarefas da equipe (decrescente)
  const sortedLeaders = [...leadersWithActiveTasks].sort((a, b) => {
    const aTeam = getTeamMembers(a.id)
    const bTeam = getTeamMembers(b.id)
    const aTaskCount = events.filter(e => aTeam.some(m => m.id === e.resourceId)).length
    const bTaskCount = events.filter(e => bTeam.some(m => m.id === e.resourceId)).length
    return bTaskCount - aTaskCount
  })

  return (
    <div className="overflow-x-auto">
      {/* Header dos dias - STICKY */}
      <div className="grid grid-cols-8 border-b bg-gray-50 sticky top-0 z-20 shadow-sm">
        <div className="p-4 border-r font-semibold text-gray-800 bg-gray-100 min-w-[220px]">
          Líder / Equipe
        </div>
        {days.map((day, index) => {
          const isToday = day.toDateString() === new Date().toDateString()
          return (
            <div key={index} className={`p-4 border-r text-center min-w-[140px] ${isToday ? 'bg-blue-50' : ''}`}>
              <div className={`font-semibold text-sm ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                {day.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()}
              </div>
              <div className={`text-sm mt-0.5 ${isToday ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
                {day.getDate()}/{day.getMonth() + 1}
              </div>
            </div>
          )
        })}
      </div>

      {/* Linhas dos líderes */}
      <div className="divide-y">
        {sortedLeaders.map(leader => {
          const isExpanded = expandedLeaders.has(leader.id)
          const team = getTeamMembers(leader.id)
          
          return (
            <div key={leader.id}>
              {/* Linha Principal do Líder */}
              <div className="grid grid-cols-8 min-h-[80px] hover:bg-gray-50 transition-colors">
                <div className="p-3 border-r bg-blue-50 flex flex-col justify-center">
                  <div className="flex items-center space-x-2 mb-1">
                    <button
                      onClick={() => toggleLeader(leader.id)}
                      className="text-gray-600 hover:text-gray-900 transition-colors"
                      title={isExpanded ? 'Recolher' : 'Expandir'}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <div>
                      <div className="font-bold text-blue-900 flex items-center space-x-1">
                        <span>👨‍💼</span>
                        <span>{leader.name}</span>
                      </div>
                      <div className="text-xs text-blue-700">
                        {team.length} {team.length === 1 ? 'membro' : 'membros'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {days.map((day, dayIndex) => {
                  const workload = getTeamWorkload(leader.id, day)
                  
                  // Cor de fundo baseada no status da equipe
                  let bgColor = 'bg-white'
                  if (workload.totalConflicts > 0) bgColor = 'bg-red-50'
                  else if (workload.totalAbsences > 0) bgColor = 'bg-yellow-50'
                  else if (workload.totalTasks >= team.length * 3) bgColor = 'bg-orange-50'
                  else if (workload.totalTasks > 0) bgColor = 'bg-green-50'

                  return (
                    <div
                      key={dayIndex}
                      className={`p-2 border-r min-h-[80px] ${bgColor}`}
                    >
                      <div className="space-y-1.5 text-center">
                        {/* Resumo da equipe */}
                        <div className="space-y-1">
                          {workload.totalTasks > 0 && (
                            <div className="text-xs font-semibold text-gray-900">
                              📋 {workload.totalTasks} {workload.totalTasks === 1 ? 'tarefa' : 'tarefas'}
                            </div>
                          )}
                          
                          {workload.activeMembers > 0 && (
                            <div className="text-xs text-gray-600">
                              👥 {workload.activeMembers}/{team.length} ativos
                            </div>
                          )}
                          
                          {workload.totalAbsences > 0 && (
                            <div className="text-xs text-orange-600 font-medium">
                              🏖️ {workload.totalAbsences} ausente{workload.totalAbsences > 1 ? 's' : ''}
                            </div>
                          )}
                          
                          {workload.totalConflicts > 0 && (
                            <div className="text-xs text-red-600 font-bold animate-pulse">
                              ⚠️ {workload.totalConflicts} conflito{workload.totalConflicts > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>

                        {/* Indicador visual de carga */}
                        {workload.totalTasks > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                workload.totalConflicts > 0 ? 'bg-red-500' :
                                workload.totalTasks >= team.length * 3 ? 'bg-orange-500' :
                                workload.totalTasks >= team.length * 2 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min((workload.totalTasks / (team.length * 3)) * 100, 100)}%`
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Membros da Equipe Expandidos */}
              {isExpanded && team.map(member => (
                <div key={member.id} className="grid grid-cols-8 min-h-[60px] bg-gray-50 border-t">
                  <div className="p-3 border-r pl-10">
                    <div className="text-sm font-medium text-gray-900">{member.name}</div>
                    <div className="text-xs text-gray-600 capitalize">{member.role}</div>
                  </div>
                  
                  {days.map((day, dayIndex) => {
                    const dayEvents = getEventsForResourceAndDay(member.id, day)
                    const personalEventsOnDay = getPersonalEventsForDay(day, member.id)
                    const hasConflictToday = hasConflict(day, member.id)
                    
                    // Cor de fundo baseada no status
                    let bgColor = 'bg-white'
                    if (hasConflictToday) bgColor = 'bg-red-50'
                    else if (personalEventsOnDay.some(e => e.blocks_work)) bgColor = 'bg-yellow-50'
                    else if (dayEvents.length >= 3) bgColor = 'bg-blue-50'

                    return (
                      <div
                        key={dayIndex}
                        className={`p-1.5 border-r cursor-pointer hover:bg-opacity-70 transition-all ${bgColor}`}
                        onClick={() => onDayClick(day, member.id)}
                      >
                        <div className="space-y-1">
                          {/* Eventos de tarefas */}
                          {dayEvents.slice(0, 2).map((event, idx) => (
                            <div
                              key={idx}
                              className="text-[9px] p-1 bg-blue-100 border border-blue-300 rounded cursor-pointer hover:bg-blue-200"
                              onClick={(e) => {
                                e.stopPropagation()
                                onEventClick?.(event)
                              }}
                              title={`${event.title} - ${event.projectName}`}
                            >
                              <div className="font-semibold text-blue-900 truncate">
                                {event.projectCode}
                              </div>
                              <div className="text-blue-700 truncate">
                                {event.title}
                              </div>
                            </div>
                          ))}

                          {dayEvents.length > 2 && (
                            <div className="text-[9px] text-center text-gray-600 bg-gray-100 rounded px-1 py-0.5">
                              +{dayEvents.length - 2}
                            </div>
                          )}

                          {/* Eventos pessoais */}
                          {personalEventsOnDay.map(event => (
                            <PersonalEventBadge
                              key={event.id}
                              event={event}
                              onClick={(e) => e.stopPropagation()}
                              compact={true}
                            />
                          ))}

                          {/* Indicador de conflito */}
                          <ConflictIndicator
                            taskCount={dayEvents.length}
                            hasBlockingEvent={personalEventsOnDay.some(e => e.blocks_work)}
                            compact={true}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Mensagem se não houver líderes */}
      {sortedLeaders.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-6xl mb-4">👨‍💼</div>
          <p className="text-lg font-medium text-gray-700">Nenhum líder com equipe ativa neste período</p>
          <p className="text-sm text-gray-500 mt-2">Os líderes aparecerão aqui quando suas equipes tiverem tarefas alocadas</p>
        </div>
      )}
    </div>
  )
}