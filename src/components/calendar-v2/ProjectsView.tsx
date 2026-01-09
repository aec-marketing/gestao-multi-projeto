'use client'

import { useState, useMemo } from 'react'
import { CalendarEvent } from '@/types/allocation.types'
import { PersonalEvent } from '@/types/personal-events.types'
import ProjectCard from './ProjectCard'
import TeamHeatmap from './TeamHeatmap'

interface ProjectsViewProps {
  dateRange: Date[]
  eventsByResource: Map<string, CalendarEvent[]>
  personalEventsByResource: Map<string, PersonalEvent[]>
  totalResources: number
  allResources?: Array<{ id: string; name: string }>
  onProjectClick?: (projectCode: string) => void
}

type ViewMode = 'cards' | 'heatmap'

/**
 * Projects view - shows team availability and project insights
 * Alternative view to the timeline, focused on projects rather than people
 */
export default function ProjectsView({
  dateRange,
  eventsByResource,
  personalEventsByResource,
  totalResources,
  allResources = [],
  onProjectClick,
}: ProjectsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'team' | 'tasks' | 'workload'>('workload')

  // Group events by project
  const projectsData = useMemo(() => {
    const projectMap = new Map<string, {
      projectCode: string
      projectName: string
      projectId: string
      events: CalendarEvent[]
    }>()

    eventsByResource.forEach(events => {
      events.forEach(event => {
        const existing = projectMap.get(event.projectCode)
        if (existing) {
          existing.events.push(event)
        } else {
          projectMap.set(event.projectCode, {
            projectCode: event.projectCode,
            projectName: event.projectName,
            projectId: event.projectId,
            events: [event],
          })
        }
      })
    })

    return Array.from(projectMap.values())
  }, [eventsByResource])

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = projectsData

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.projectCode.toLowerCase().includes(query) ||
        p.projectName.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.projectName.localeCompare(b.projectName)
        case 'team':
          // Count unique team members
          const teamA = new Set(a.events.map(e => e.resourceId)).size
          const teamB = new Set(b.events.map(e => e.resourceId)).size
          return teamB - teamA
        case 'tasks':
          return b.events.length - a.events.length
        case 'workload':
          // Calculate workload intensity (tasks per team member)
          const workloadA = a.events.length / new Set(a.events.map(e => e.resourceId)).size
          const workloadB = b.events.length / new Set(b.events.map(e => e.resourceId)).size
          return workloadB - workloadA
        default:
          return 0
      }
    })

    return filtered
  }, [projectsData, searchQuery, sortBy])

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Controls bar */}
      <div className="bg-white border-b p-4 space-y-3">
        {/* View mode toggle + Search + Sort */}
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`
                px-3 py-1.5 text-sm font-medium rounded transition-colors
                ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              🗂️ Cards de Projetos
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`
                px-3 py-1.5 text-sm font-medium rounded transition-colors
                ${viewMode === 'heatmap' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              📊 Mapa de Calor
            </button>
          </div>

          {/* Search (only for cards view) */}
          {viewMode === 'cards' && (
            <>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Buscar projeto por código ou nome..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Sort dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Ordenar:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="workload">Carga de Trabalho</option>
                  <option value="tasks">Número de Tarefas</option>
                  <option value="team">Tamanho da Equipe</option>
                  <option value="name">Nome</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Stats summary (only for cards view) */}
        {viewMode === 'cards' && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium text-gray-900">{filteredProjects.length}</span> projetos
            </div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div>
              <span className="font-medium text-gray-900">{totalResources}</span> recursos
            </div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div>
              <span className="font-medium text-gray-900">
                {Array.from(eventsByResource.values()).reduce((sum, events) => sum + events.length, 0)}
              </span> tarefas totais
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'heatmap' ? (
          <TeamHeatmap
            dateRange={dateRange}
            eventsByResource={eventsByResource}
            personalEventsByResource={personalEventsByResource}
            totalResources={totalResources}
            allResources={allResources}
          />
        ) : (
          <>
            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProjects.map(project => (
                  <ProjectCard
                    key={project.projectCode}
                    projectCode={project.projectCode}
                    projectName={project.projectName}
                    events={project.events}
                    dateRange={dateRange}
                    onProjectClick={onProjectClick}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">🔍</div>
                  <div className="font-medium">Nenhum projeto encontrado</div>
                  <div className="text-sm mt-1">
                    {searchQuery ? 'Tente ajustar sua busca' : 'Não há projetos ativos neste período'}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
