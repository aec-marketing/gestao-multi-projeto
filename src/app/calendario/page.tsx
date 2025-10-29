'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Resource } from '@/types/database.types'
import { AllocationWithDetails, PRIORITY_CONFIG } from '@/types/allocation.types'
import { parseLocalDate } from '@/utils/date.utils'
import {
  PersonalEvent,
  PersonalEventWithResource,
  doesEventBlockDate
} from '@/types/personal-events.types'
import PersonalEventModal from '@/components/modals/PersonalEventModal'
import TaskDetailModal from '@/components/modals/TaskDetailModal'
import PersonalEventBadge from '@/components/calendar/PersonalEventBadge'
import ConflictIndicator from '@/components/calendar/ConflictIndicator'
import ProjectView from '@/components/calendar/ProjectView'
import LeaderView from '@/components/calendar/LeaderView'

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

// Paleta de cores para projetos (será gerada dinamicamente)
const PROJECT_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-900' },
  { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-900' },
  { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-900' },
  { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-900' },
  { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-900' },
  { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-900' },
  { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-900' },
  { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-900' },
  { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-900' },
  { bg: 'bg-lime-100', border: 'border-lime-300', text: 'text-lime-900' }
]

function CalendarPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectFilter = searchParams?.get('projeto')

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'week' | 'month' | 'project' | 'leader'>('week')
  const [resources, setResources] = useState<Resource[]>([])
  const [allocations, setAllocations] = useState<AllocationWithDetails[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedResource, setSelectedResource] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [projectColorMap, setProjectColorMap] = useState<Record<string, typeof PROJECT_COLORS[0]>>({})

  // Estados para eventos pessoais
  const [personalEvents, setPersonalEvents] = useState<PersonalEventWithResource[]>([])
  const [showEventModal, setShowEventModal] = useState(false)
  const [selectedDateForEvent, setSelectedDateForEvent] = useState<Date | null>(null)
  const [selectedResourceForEvent, setSelectedResourceForEvent] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<PersonalEvent | null>(null)

  // Estados para modal de detalhes da tarefa
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<CalendarEvent[]>([])
  const [selectedProjectInfo, setSelectedProjectInfo] = useState<{
    projectName: string
    projectCode: string
    resourceName: string
  } | null>(null)

  // Estados para projetos e líderes
  const [projects, setProjects] = useState<Array<{
    id: string
    code: string
    name: string
  }>>([])

  const [leaders, setLeaders] = useState<Array<{
    id: string
    name: string
  }>>([])


  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (allocations.length > 0) {
      generateCalendarEvents()
      generateProjectColors()
    }
  }, [allocations, selectedResource, projectFilter])

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

      // Carregar projetos únicos
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, code, name')
        .order('code', { ascending: true })

      setProjects(projectsData || [])

      // Carregar líderes (recursos com role = 'lider' ou similar)
      const { data: leadersData } = await supabase
        .from('resources')
        .select('id, name, role')
        .eq('is_active', true)
        .order('name', { ascending: true })

      // Filtrar líderes no cliente
      const filteredLeaders = leadersData?.filter(r =>
        r.role?.toLowerCase().includes('lider') ||
        r.role?.toLowerCase().includes('líder') ||
        r.role?.toLowerCase().includes('gerente')
      ) || []

      setLeaders(filteredLeaders)

      // Carregar eventos pessoais
      await fetchPersonalEvents()
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchPersonalEvents() {
    try {
      const { data, error } = await supabase
        .from('personal_events')
        .select(`
          *,
          resource:resources(*)
        `)
        .order('start_date', { ascending: true })

      if (error) throw error

      setPersonalEvents(data || [])
    } catch (error) {
      console.error('Erro ao buscar eventos pessoais:', error)
    }
  }

  function generateProjectColors() {
    const projects = new Set(allocations.map(a => a.task.project.code))
    const colorMap: Record<string, typeof PROJECT_COLORS[0]> = {}
    
    Array.from(projects).forEach((projectCode, index) => {
      colorMap[projectCode] = PROJECT_COLORS[index % PROJECT_COLORS.length]
    })
    
    setProjectColorMap(colorMap)
  }

  function generateCalendarEvents() {
    let filteredAllocations = allocations

    // Filtrar por recurso selecionado
    if (selectedResource) {
      filteredAllocations = filteredAllocations.filter(a => a.resource_id === selectedResource)
    }

    // Filtrar por projeto (se vier da URL)
    if (projectFilter) {
      filteredAllocations = filteredAllocations.filter(
        a => a.task.project.code === projectFilter
      )
    }

    const calendarEvents: CalendarEvent[] = filteredAllocations
      .filter(allocation => allocation.start_date && allocation.end_date)
      .map(allocation => ({
        id: allocation.id,
        title: allocation.task.name,
        startDate: parseLocalDate(allocation.start_date!)!,
        endDate: parseLocalDate(allocation.end_date!)!,
        priority: allocation.priority,
        resourceId: allocation.resource_id,
        resourceName: allocation.resource.name,
        projectId: allocation.task.project_id,
        projectName: allocation.task.project.name,
        projectCode: allocation.task.project.code,
        taskType: allocation.task.type
      }))
      .filter(event => event.startDate && event.endDate)

    setEvents(calendarEvents)
  }

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
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
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

      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

      return eventStart <= dayEnd && eventEnd >= dayStart
    })
  }

  function getPersonalEventsForDay(date: Date, resourceId?: string): PersonalEventWithResource[] {
    return personalEvents.filter(event => {
      if (resourceId && event.resource_id !== resourceId) return false

      const eventStart = parseLocalDate(event.start_date)
      const eventEnd = parseLocalDate(event.end_date)

      if (!eventStart || !eventEnd) return false

      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

      return eventStart <= dayEnd && eventEnd >= dayStart
    })
  }

  function hasConflict(date: Date, resourceId: string): boolean {
    const dayEvents = getEventsForDay(date).filter(e => e.resourceId === resourceId)
    const personalEventsOnDay = getPersonalEventsForDay(date, resourceId)
    const hasBlockingEvent = personalEventsOnDay.some(e => e.blocks_work)

    return dayEvents.length > 0 && hasBlockingEvent
  }

  function handleDayClick(date: Date, resourceId?: string) {
    setSelectedDateForEvent(date)
    setSelectedResourceForEvent(resourceId || null)
    setEditingEvent(null)
    setShowEventModal(true)
  }

  function handleEventClick(event: PersonalEvent) {
    setEditingEvent(event)
    setShowEventModal(true)
  }

  function handleEventSuccess() {
    fetchPersonalEvents()
  }

  function handleTaskBarClick(projectCode: string, resourceId: string, resourceName: string) {
    // Encontrar todas as tarefas desse projeto para esse recurso
    const projectTasks = events.filter(
      e => e.projectCode === projectCode && e.resourceId === resourceId
    )

    if (projectTasks.length > 0) {
      setSelectedTasks(projectTasks)
      setSelectedProjectInfo({
        projectName: projectTasks[0].projectName,
        projectCode: projectTasks[0].projectCode,
        resourceName
      })
      setShowTaskModal(true)
    }
  }

  function handleProjectDayClick(date: Date, projectId: string) {
    // Redirecionar para página do projeto ou abrir modal
    window.open(`/projeto/${projectId}`, '_blank')
  }

  function handleTaskClick(event: CalendarEvent) {
    // Redirecionar para página do projeto com tarefa destacada
    // Implementar conforme necessário
    console.log('Task clicked:', event)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4 text-lg">Carregando calendário...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header da Página */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40 flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumb e Título */}
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Voltar
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  📅 Calendário de Recursos
                  {view === 'week' && ' - Por Recurso'}
                  {view === 'project' && ' - Por Projeto'}
                  {view === 'leader' && ' - Por Líder'}
                  {view === 'month' && ' - Visão Mensal'}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {events.length} alocações • {displayResources.length} recursos
                  {projectFilter && ` • Projeto: ${projectFilter}`}
                </p>
              </div>
            </div>

            {/* Botão Adicionar Ausência */}
            <button
              onClick={() => {
                setSelectedDateForEvent(new Date())
                setSelectedResourceForEvent(null)
                setEditingEvent(null)
                setShowEventModal(true)
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2 transition-colors"
            >
              <span>➕</span>
              <span>Adicionar Ausência</span>
            </button>
          </div>
        </div>
      </header>

      {/* Controles do Calendário */}
      <div className="bg-white border-b sticky top-[73px] z-30 flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Navegação de Período */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigatePeriod('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-900 transition-colors"
                  title="Período anterior"
                >
                  ←
                </button>
                <h3 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                  {view === 'week' 
                    ? `Semana de ${calendarDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                    : currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                  }
                </h3>
                <button
                  onClick={() => navigatePeriod('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-900 transition-colors"
                  title="Próximo período"
                >
                  →
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-900 transition-colors"
                >
                  Hoje
                </button>
              </div>
            </div>

            {/* Filtros e Visualizações */}
            <div className="flex items-center space-x-4">
              {/* Filtro de Recurso */}
              <select
                value={selectedResource || ''}
                onChange={(e) => setSelectedResource(e.target.value || null)}
                className="px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm"
              >
                <option value="">Todos os recursos</option>
                {resources.map(resource => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} - {resource.role}
                  </option>
                ))}
              </select>

              {/* Toggle de Visualização - 4 OPÇÕES */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setView('week')}
                  className={`px-3 py-2 rounded text-sm transition-all ${
                    view === 'week'
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📅 Por Recurso
                </button>
                <button
                  onClick={() => setView('project')}
                  className={`px-3 py-2 rounded text-sm transition-all ${
                    view === 'project'
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📊 Por Projeto
                </button>
                <button
                  onClick={() => setView('leader')}
                  className={`px-3 py-2 rounded text-sm transition-all ${
                    view === 'leader'
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  👨‍💼 Por Líder
                </button>
                <button
                  onClick={() => setView('month')}
                  className={`px-3 py-2 rounded text-sm transition-all ${
                    view === 'month'
                      ? 'bg-white text-gray-900 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📆 Mês
                </button>
              </div>
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-50 border border-yellow-300 rounded"></div>
                <span className="text-gray-700">Ausência</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-50 border border-red-300 rounded"></div>
                <span className="text-gray-700">Conflito</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-50 border border-blue-300 rounded"></div>
                <span className="text-gray-700">Alta Carga (3+ tarefas)</span>
              </div>
            </div>

            {/* Legenda de Prioridades (agora secundária) */}
            <div className="flex items-center space-x-4 text-xs text-gray-600">
              <span className="font-medium">Bordas de Prioridade:</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border-2 border-red-500 rounded"></div>
                <span>Alta</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border-2 border-yellow-500 rounded"></div>
                <span>Média</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border-2 border-green-500 rounded"></div>
                <span>Baixa</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Área do Calendário */}
      <main className="flex-1 overflow-hidden">
        <div className="bg-white shadow-sm border h-full overflow-y-auto">
          {view === 'week' && (
            <WeekView
              days={calendarDays}
              resources={displayResources}
              events={events}
              getEventsForDay={getEventsForDay}
              getPersonalEventsForDay={getPersonalEventsForDay}
              hasConflict={hasConflict}
              handleDayClick={handleDayClick}
              handleEventClick={handleEventClick}
              handleTaskBarClick={handleTaskBarClick}
              projectColorMap={projectColorMap}
            />
          )}

          {view === 'project' && (
            <ProjectView
              days={calendarDays}
              events={events}
              personalEvents={personalEvents}
              projects={projects}
              onDayClick={handleProjectDayClick}
              onTaskClick={handleTaskClick}
            />
          )}

          {view === 'leader' && (
            <LeaderView
              days={calendarDays}
              events={events}
              personalEvents={personalEvents}
              resources={resources}
              leaders={leaders}
              onDayClick={handleDayClick}
              onEventClick={handleTaskClick}
            />
          )}

          {view === 'month' && (
            <MonthView
              days={calendarDays}
              events={events}
              getEventsForDay={getEventsForDay}
              currentDate={currentDate}
              getPersonalEventsForDay={getPersonalEventsForDay}
              handleDayClick={handleDayClick}
              handleEventClick={handleEventClick}
              projectColorMap={projectColorMap}
            />
          )}
        </div>
      </main>

      {/* Modal de Eventos Pessoais */}
      <PersonalEventModal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false)
          setEditingEvent(null)
          setSelectedDateForEvent(null)
          setSelectedResourceForEvent(null)
        }}
        onSuccess={handleEventSuccess}
        resources={resources}
        selectedResourceId={selectedResourceForEvent || undefined}
        selectedDate={selectedDateForEvent || undefined}
        eventToEdit={editingEvent || undefined}
      />

      {/* Modal de Detalhes da Tarefa */}
      {selectedProjectInfo && (
        <TaskDetailModal
          isOpen={showTaskModal}
          onClose={() => {
            setShowTaskModal(false)
            setSelectedTasks([])
            setSelectedProjectInfo(null)
          }}
          tasks={selectedTasks}
          projectName={selectedProjectInfo.projectName}
          projectCode={selectedProjectInfo.projectCode}
          resourceName={selectedProjectInfo.resourceName}
        />
      )}
    </div>
  )
}

// Componente para visualização semanal
function WeekView({
  days,
  resources,
  events,
  getEventsForDay,
  getPersonalEventsForDay,
  hasConflict,
  handleDayClick,
  handleEventClick,
  handleTaskBarClick,
  projectColorMap
}: {
  days: Date[]
  resources: Resource[]
  events: CalendarEvent[]
  getEventsForDay: (date: Date) => CalendarEvent[]
  getPersonalEventsForDay: (date: Date, resourceId?: string) => PersonalEventWithResource[]
  hasConflict: (date: Date, resourceId: string) => boolean
  handleDayClick: (date: Date, resourceId?: string) => void
  handleEventClick: (event: PersonalEvent) => void
  handleTaskBarClick: (projectCode: string, resourceId: string, resourceName: string) => void
  projectColorMap: Record<string, typeof PROJECT_COLORS[0]>
}) {
  // Função para mesclar eventos consecutivos do mesmo projeto
  function getMergedEvents(resourceId: string, daysList: Date[]) {
    const resourceEvents = events.filter(e => e.resourceId === resourceId)

    const merged: Array<{
      projectCode: string
      projectName: string
      startDay: number
      endDay: number
      tasks: CalendarEvent[]
      priority: 'alta' | 'media' | 'baixa'
    }> = []

    resourceEvents.forEach(event => {
      // Encontrar o primeiro e último dia que o evento intersecta na semana
      let eventStartDay = -1
      let eventEndDay = -1

      daysList.forEach((day, index) => {
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)

        const eventStart = new Date(event.startDate)
        const eventEnd = new Date(event.endDate)

        // Verificar se o dia intersecta com o evento
        if (eventStart <= dayEnd && eventEnd >= dayStart) {
          if (eventStartDay === -1) eventStartDay = index
          eventEndDay = index
        }
      })

      if (eventStartDay === -1 || eventEndDay === -1) {
        return
      }

      // Tentar mesclar com evento existente do mesmo projeto
      const existingMerged = merged.find(m => 
        m.projectCode === event.projectCode &&
        m.endDay === eventStartDay - 1
      )

      if (existingMerged) {
        existingMerged.endDay = eventEndDay
        existingMerged.tasks.push(event)
        // Prioridade mais alta prevalece
        if (event.priority === 'alta') existingMerged.priority = 'alta'
        else if (event.priority === 'media' && existingMerged.priority === 'baixa') {
          existingMerged.priority = 'media'
        }
      } else {
        merged.push({
          projectCode: event.projectCode,
          projectName: event.projectName,
          startDay: eventStartDay,
          endDay: eventEndDay,
          tasks: [event],
          priority: event.priority
        })
      }
    })

    return merged
  }

  const priorityBorder = {
    alta: 'border-l-4 border-l-red-500',
    media: 'border-l-4 border-l-yellow-500',
    baixa: 'border-l-4 border-l-green-500'
  }

  return (
    <div className="overflow-x-auto">
      {/* Header dos dias - STICKY */}
      <div className="grid grid-cols-8 border-b bg-gray-50 sticky top-0 z-20 shadow-sm">
        <div className="p-3 border-r font-medium text-gray-700">Recurso</div>
        {days.map((day, index) => {
          const isToday = day.toDateString() === new Date().toDateString()
          return (
            <div key={index} className={`p-3 border-r text-center ${isToday ? 'bg-blue-50' : ''}`}>
              <div className={`font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
              </div>
              <div className={`text-sm ${isToday ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
                {day.getDate()}/{day.getMonth() + 1}
              </div>
            </div>
          )
        })}
      </div>

      {/* Linhas dos recursos */}
      <div className="divide-y">
        {resources.map(resource => {
          const mergedEvents = getMergedEvents(resource.id, days)

          return (
            <div key={resource.id} className="relative min-h-[120px] border-b">
              {/* Camada de barras contínuas (absolute, acima do grid) */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="grid grid-cols-8 h-full">
                  {/* Coluna vazia para o nome do recurso */}
                  <div></div>

                  {/* Container para os dias - aqui vão as barras */}
                  <div className="col-span-7 relative pt-2 px-2">
                    <div className="space-y-1">
                      {mergedEvents.map((merged, idx) => {
                        const projectColor = projectColorMap[merged.projectCode] || PROJECT_COLORS[0]

                        // Calcular posição e largura da barra
                        const totalDays = days.length
                        const startPercent = (merged.startDay / totalDays) * 100
                        const widthPercent = ((merged.endDay - merged.startDay + 1) / totalDays) * 100

                        return (
                          <div
                            key={`${merged.projectCode}-${idx}`}
                            className={`
                              ${projectColor.bg} ${projectColor.border} ${projectColor.text}
                              border ${priorityBorder[merged.priority]}
                              px-2 py-1 text-[10px] rounded cursor-pointer hover:opacity-90 transition-opacity
                              pointer-events-auto flex items-center justify-between
                            `}
                            style={{
                              position: 'absolute',
                              left: `${startPercent}%`,
                              width: `${widthPercent}%`,
                              top: `${idx * 24}px`
                            }}
                            title={`${merged.projectName}\n${merged.tasks.length} tarefa(s): ${merged.tasks.map(t => t.title).join(', ')}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTaskBarClick(merged.projectCode, resource.id, resource.name)
                            }}
                          >
                            <div className="font-bold truncate flex-1">
                              {merged.projectCode}
                            </div>
                            <div className="text-[9px] opacity-90 ml-1 whitespace-nowrap">
                              {merged.tasks.length}x
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid de células (por baixo) */}
              <div className="grid grid-cols-8 relative z-0">
                <div className="p-3 border-r bg-gray-50 flex flex-col justify-center">
                  <div className="font-medium text-gray-900">{resource.name}</div>
                  <div className="text-sm text-gray-600 capitalize">{resource.role}</div>
                </div>

                {days.map((day, dayIndex) => {
                  const personalEventsForDay = getPersonalEventsForDay(day, resource.id)
                  const hasConflictToday = hasConflict(day, resource.id)
                  const dayEvents = getEventsForDay(day).filter(e => e.resourceId === resource.id)

                  // Cor de fundo baseada no status
                  let bgColor = 'bg-white'
                  if (hasConflictToday) bgColor = 'bg-red-50'
                  else if (personalEventsForDay.some(e => e.blocks_work)) bgColor = 'bg-yellow-50'
                  else if (dayEvents.length >= 3) bgColor = 'bg-blue-50'

                  return (
  <div
    key={dayIndex}
    className={`p-2 border-r min-h-[120px] relative cursor-pointer hover:bg-opacity-70 transition-all ${bgColor}`}
    onClick={() => handleDayClick(day, resource.id)}
  >
    {/* Espaço reservado para as barras (que estão em absolute acima) */}
    <div style={{ height: `${mergedEvents.length * 24}px` }}></div>

    {/* ========== CONTEÚDO NORMAL ========== */}
    <div className="space-y-1.5 mt-2">
      {/* Eventos Pessoais */}
      {personalEventsForDay.map(event => (
        <PersonalEventBadge
          key={event.id}
          event={event}
          onClick={(e) => {
            e.stopPropagation()
            handleEventClick(event)
          }}
          compact={true}
        />
      ))}

      {/* Indicador de Conflito */}
      <ConflictIndicator
        taskCount={dayEvents.length}
        hasBlockingEvent={personalEventsForDay.some(e => e.blocks_work)}
        compact={true}
      />
    </div>
  </div>
)
                })}
              </div>
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
  currentDate,
  getPersonalEventsForDay,
  handleDayClick,
  handleEventClick,
  projectColorMap
}: {
  days: Date[]
  events: CalendarEvent[]
  getEventsForDay: (date: Date) => CalendarEvent[]
  currentDate: Date
  getPersonalEventsForDay: (date: Date, resourceId?: string) => PersonalEventWithResource[]
  handleDayClick: (date: Date, resourceId?: string) => void
  handleEventClick: (event: PersonalEvent) => void
  projectColorMap: Record<string, typeof PROJECT_COLORS[0]>
}) {
  const monthGrid = []
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const startDay = startOfMonth.getDay()
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  
  for (let i = 0; i < startDay; i++) {
    monthGrid.push(null)
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    monthGrid.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i))
  }

  const priorityBorder = {
    alta: 'border-l-2 border-l-red-500',
    media: 'border-l-2 border-l-yellow-500',
    baixa: 'border-l-2 border-l-green-500'
  }

  return (
    <div className="h-full">
      {/* Header dos dias da semana - STICKY */}
      <div className="grid grid-cols-7 border-b bg-gray-50 sticky top-0 z-20 shadow-sm">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="p-3 border-r text-center font-medium text-gray-700">
            {day}
          </div>
        ))}
      </div>

      {/* Grid do mês */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {monthGrid.map((day, index) => {
          if (!day) {
            return <div key={index} className="border-r border-b bg-gray-50 min-h-[140px]"></div>
          }

          const dayEvents = getEventsForDay(day)
          const personalEventsForDay = getPersonalEventsForDay(day)
          const isToday = day.toDateString() === new Date().toDateString()
          const hasBlockingEvent = personalEventsForDay.some(e => e.blocks_work)
          const hasConflict = dayEvents.length > 0 && hasBlockingEvent

          // Cor de fundo baseada no status
          let bgColor = 'bg-white'
          if (hasConflict) bgColor = 'bg-red-50'
          else if (hasBlockingEvent) bgColor = 'bg-yellow-50'
          else if (dayEvents.length >= 3) bgColor = 'bg-blue-50'

          // Agrupar eventos por projeto
          const eventsByProject = dayEvents.reduce((acc, event) => {
            if (!acc[event.projectCode]) {
              acc[event.projectCode] = []
            }
            acc[event.projectCode].push(event)
            return acc
          }, {} as Record<string, CalendarEvent[]>)

          return (
            <div
              key={index}
              className={`border-r border-b p-2 min-h-[140px] hover:bg-opacity-70 cursor-pointer transition-all relative ${bgColor}`}
              onClick={() => handleDayClick(day)}
            >
              <div className={`text-sm font-semibold mb-2 ${
                isToday ? 'text-blue-600 bg-blue-100 rounded-full w-7 h-7 flex items-center justify-center' : 'text-gray-900'
              }`}>
                {day.getDate()}
              </div>

              <div className="space-y-1">
                {/* Eventos Pessoais */}
                {personalEventsForDay.slice(0, 2).map(event => (
                  <PersonalEventBadge
                    key={event.id}
                    event={event}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEventClick(event)
                    }}
                    compact={true}
                  />
                ))}

                {/* Eventos de Tarefas agrupados por projeto */}
                {Object.entries(eventsByProject).slice(0, 2).map(([projectCode, projectEvents]) => {
                  const projectColor = projectColorMap[projectCode] || PROJECT_COLORS[0]
                  const highestPriority = projectEvents.reduce((highest, event) => {
                    if (event.priority === 'alta') return 'alta'
                    if (event.priority === 'media' && highest === 'baixa') return 'media'
                    return highest
                  }, 'baixa' as 'alta' | 'media' | 'baixa')

                  return (
                    <div
                      key={projectCode}
                      className={`
                        ${projectColor.bg} ${projectColor.border} ${projectColor.text}
                        border ${priorityBorder[highestPriority]}
                        p-1 rounded text-[10px] cursor-pointer hover:opacity-80
                      `}
                      title={`${projectEvents[0].projectName}\n${projectEvents.length} tarefa(s): ${projectEvents.map(e => e.title).join(', ')}`}
                    >
                      <div className="font-semibold truncate">{projectCode}</div>
                      <div className="opacity-90 truncate">
                        {projectEvents.length} {projectEvents.length === 1 ? 'tarefa' : 'tarefas'}
                      </div>
                    </div>
                  )
                })}

                {(Object.keys(eventsByProject).length + personalEventsForDay.length) > 4 && (
                  <div className="text-[10px] text-gray-600 text-center bg-gray-100 rounded p-1">
                    +{(Object.keys(eventsByProject).length + personalEventsForDay.length) - 4} mais
                  </div>
                )}
              </div>

              {/* Indicador de Conflito */}
              {hasConflict && (
                <div className="absolute top-1 right-1">
                  <ConflictIndicator
                    taskCount={dayEvents.length}
                    hasBlockingEvent={hasBlockingEvent}
                    compact={true}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4 text-lg">Carregando calendário...</p>
        </div>
      </div>
    }>
      <CalendarPageContent />
    </Suspense>
  )
}