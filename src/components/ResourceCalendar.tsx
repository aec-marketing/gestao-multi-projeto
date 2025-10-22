'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Resource } from '@/types/database.types'
import { AllocationWithDetails, PRIORITY_CONFIG } from '@/types/allocation.types'

interface ResourceCalendarProps {
  onClose: () => void
}

interface CalendarEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  priority: 'alta' | 'media' | 'baixa'
  resourceId: string
  resourceName: string
  projectName: string
  taskType: string
}

export default function ResourceCalendar({ onClose }: ResourceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'week' | 'month'>('week')
  const [resources, setResources] = useState<Resource[]>([])
  const [allocations, setAllocations] = useState<AllocationWithDetails[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedResource, setSelectedResource] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (allocations.length > 0) {
      generateCalendarEvents()
    }
  }, [allocations, selectedResource])

  async function loadData() {
    try {
      // Carregar recursos
      const { data: resourcesData } = await supabase
        .from('resources')
        .select('*')
        .eq('is_active', true)
        .order('role', { ascending: true })

      // Carregar alocações com detalhes
      const { data: allocationsData } = await supabase
        .from('allocations')
        .select(`
          *,
          resource:resources(*),
          task:tasks(
            *,
            project:projects(*)
          )
        `)
        .order('start_date', { ascending: true })

      setResources(resourcesData || [])
      setAllocations(allocationsData || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function generateCalendarEvents() {
    const filteredAllocations = selectedResource 
      ? allocations.filter(a => a.resource_id === selectedResource)
      : allocations

    const calendarEvents: CalendarEvent[] = filteredAllocations
      .filter(allocation => allocation.start_date && allocation.end_date)
      .map(allocation => ({
        id: allocation.id,
        title: allocation.task.name,
        startDate: new Date(allocation.start_date!),
        endDate: new Date(allocation.end_date!),
        priority: allocation.priority,
        resourceId: allocation.resource_id,
        resourceName: allocation.resource.name,
        projectName: allocation.task.project.name,
        taskType: allocation.task.type
      }))

    setEvents(calendarEvents)
  }

  // Gerar dias da semana ou mês
  function generateCalendarDays() {
    const days = []
    const startOfPeriod = view === 'week' ? getStartOfWeek(currentDate) : getStartOfMonth(currentDate)
    const daysCount = view === 'week' ? 7 : getDaysInMonth(currentDate)

    for (let i = 0; i < daysCount; i++) {
      const date = new Date(startOfPeriod)
      date.setDate(startOfPeriod.getDate() + i)
      days.push(date)
    }

    return days
  }

  function getStartOfWeek(date: Date): Date {
    const start = new Date(date)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1) // Segunda-feira
    start.setDate(diff)
    start.setHours(0, 0, 0, 0)
    return start
  }

  function getStartOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1)
  }

  function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  function getEventsForDay(date: Date): CalendarEvent[] {
    return events.filter(event => {
      const eventStart = new Date(event.startDate)
      const eventEnd = new Date(event.endDate)
      
      // Normalizar datas para comparação (apenas dia)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
      
      return eventStart <= dayEnd && eventEnd >= dayStart
    })
  }

  function navigatePeriod(direction: 'prev' | 'next') {
    const newDate = new Date(currentDate)
    if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  const calendarDays = generateCalendarDays()
  const displayResources = selectedResource 
    ? resources.filter(r => r.id === selectedResource)
    : resources

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Carregando calendário...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              📅 Calendário de Recursos
            </h2>
            <p className="text-gray-600">
              {events.length} alocações • {displayResources.length} recursos
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Controles */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Navegação de período */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigatePeriod('prev')}
                  className="p-2 hover:bg-gray-200 rounded-lg text-gray-900"
                >
                  ←
                </button>
                <h3 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                  {view === 'week' 
                    ? `Semana de ${calendarDays[0].toLocaleDateString('pt-BR')} a ${calendarDays[6].toLocaleDateString('pt-BR')}`
                    : currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                  }
                </h3>
                <button
                  onClick={() => navigatePeriod('next')}
                  className="p-2 hover:bg-gray-200 rounded-lg text-gray-900"
                >
                  →
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Hoje
                </button>
              </div>

              {/* Seletor de vista */}
              <div className="flex bg-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setView('week')}
                  className={`px-3 py-1 rounded text-sm ${
                    view === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  Semana
                </button>
                <button
                  onClick={() => setView('month')}
                  className={`px-3 py-1 rounded text-sm ${
                    view === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                  }`}
                >
                  Mês
                </button>
              </div>
            </div>

            {/* Filtro por recurso */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Recurso:</label>
              <select
                value={selectedResource || ''}
                onChange={(e) => setSelectedResource(e.target.value || null)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
              >
                <option value="">Todos os recursos</option>
                {resources.map(resource => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} ({resource.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Calendário */}
        <div className="flex-1 overflow-auto">
          {view === 'week' ? (
            <WeekView 
              days={calendarDays}
              resources={displayResources}
              events={events}
              getEventsForDay={getEventsForDay}
            />
          ) : (
            <MonthView 
              days={calendarDays}
              events={events}
              getEventsForDay={getEventsForDay}
              currentDate={currentDate}
            />
          )}
        </div>

        {/* Legenda */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Prioridades:</h4>
              <div className="flex space-x-4 text-sm">
                {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                  <div key={priority} className="flex items-center">
                    <div className={`w-4 h-4 rounded mr-2 ${config.badgeColor}`}></div>
                    <span className="text-gray-700">{config.label}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="text-right text-xs text-gray-500">
              <p>💡 Clique em uma alocação para ver detalhes</p>
              <p>📊 Use os filtros para focar em recursos específicos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Componente para visualização semanal
function WeekView({ 
  days, 
  resources, 
  events, 
  getEventsForDay 
}: {
  days: Date[]
  resources: Resource[]
  events: CalendarEvent[]
  getEventsForDay: (date: Date) => CalendarEvent[]
}) {
  return (
    <div className="h-full">
      {/* Header dos dias */}
      <div className="grid grid-cols-8 border-b bg-gray-50 sticky top-0">
        <div className="p-3 border-r font-medium text-gray-700">Recurso</div>
        {days.map((day, index) => (
          <div key={index} className="p-3 border-r text-center">
            <div className="font-medium text-gray-900">
              {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
            </div>
            <div className="text-sm text-gray-600">
              {day.getDate()}/{day.getMonth() + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Linhas dos recursos */}
      <div className="divide-y">
        {resources.map(resource => {
          const resourceEvents = events.filter(e => e.resourceId === resource.id)
          
          return (
            <div key={resource.id} className="grid grid-cols-8 min-h-[80px]">
              <div className="p-3 border-r bg-gray-50">
                <div className="font-medium text-gray-900">{resource.name}</div>
                <div className="text-sm text-gray-600 capitalize">{resource.role}</div>
              </div>
              
              {days.map((day, dayIndex) => {
                const dayEvents = resourceEvents.filter(event => {
                  const eventStart = new Date(event.startDate)
                  const eventEnd = new Date(event.endDate)
                  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
                  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
                  
                  return eventStart <= dayEnd && eventEnd >= dayStart
                })

                return (
                  <div key={dayIndex} className="p-1 border-r min-h-[80px] relative">
                    <div className="space-y-1">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          className={`p-1 rounded text-xs cursor-pointer hover:opacity-80 ${
                            PRIORITY_CONFIG[event.priority].color
                          }`}
                          title={`${event.title} - ${event.projectName}`}
                        >
                          <div className="font-medium truncate text-gray-900">{event.title}</div>
                          <div className="text-xs opacity-75 truncate text-gray-700">{event.projectName}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Componente para visualização mensal
function MonthView({ 
  days, 
  events, 
  getEventsForDay, 
  currentDate 
}: {
  days: Date[]
  events: CalendarEvent[]
  getEventsForDay: (date: Date) => CalendarEvent[]
  currentDate: Date
}) {
  // Criar grid do mês
  const monthGrid = []
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const startDay = startOfMonth.getDay()
  const daysInMonth = getDaysInMonth(currentDate)
  
  // Adicionar dias vazios do mês anterior
  for (let i = 0; i < startDay; i++) {
    monthGrid.push(null)
  }
  
  // Adicionar dias do mês
  for (let i = 1; i <= daysInMonth; i++) {
    monthGrid.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i))
  }

  function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  return (
    <div className="h-full">
      {/* Header dos dias da semana */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="p-3 border-r text-center font-medium text-gray-700">
            {day}
          </div>
        ))}
      </div>

      {/* Grid do mês */}
      <div className="grid grid-cols-7" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
        {monthGrid.map((day, index) => {
          if (!day) {
            return <div key={index} className="border-r border-b bg-gray-50"></div>
          }

          const dayEvents = getEventsForDay(day)
          const isToday = day.toDateString() === new Date().toDateString()

          return (
            <div key={index} className="border-r border-b p-2 min-h-[120px] bg-white">
              <div className={`text-sm font-medium mb-2 ${
                isToday ? 'text-blue-600' : 'text-gray-900'
              }`}>
                {day.getDate()}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className={`p-1 rounded text-xs cursor-pointer hover:opacity-80 ${
                      PRIORITY_CONFIG[event.priority].color
                    }`}
                    title={`${event.title} - ${event.resourceName} - ${event.projectName}`}
                  >
                    <div className="font-medium truncate text-gray-900">{event.resourceName}</div>
                    <div className="truncate text-gray-700">{event.title}</div>
                  </div>
                ))}
                
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-600 text-center bg-gray-100 rounded p-1">
                    +{dayEvents.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}