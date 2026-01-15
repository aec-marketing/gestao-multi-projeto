'use client'

import { useState } from 'react'
import { useCalendarDates, TimelineZoom } from '@/hooks/calendar/useCalendarDates'
import { useCalendarFilters } from '@/hooks/calendar/useCalendarFilters'
import { useCalendarData } from '@/hooks/calendar/useCalendarData'
import { usePersonalEvents } from '@/hooks/useResources'
import { getCurrentMonth } from '@/utils/calendar/calendar.utils'
import CalendarHeader from './CalendarHeader'
import TimelineView from './TimelineView'
import ProjectsView from './ProjectsView'
import PersonalEventModal from '../modals/PersonalEventModal'

/**
 * Main calendar layout component
 * Manages state and coordinates all sub-components
 */
export default function CalendarLayout() {
  // Month navigation state
  const [currentMonth, setCurrentMonth] = useState<Date>(getCurrentMonth())

  // Zoom state
  const [zoom, setZoom] = useState<TimelineZoom>('month')

  // Tab state (prepare for future Projects tab)
  const [activeTab, setActiveTab] = useState<'timeline' | 'projects'>('timeline')

  // Personal event modal state
  const [showEventModal, setShowEventModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedResourceForEvent, setSelectedResourceForEvent] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<any>(null)

  // Filter state
  const {
    selectedResource,
    selectedProject,
    selectedRoleGroups,
    setSelectedResource,
    setSelectedProject,
    resetFilters,
    hasActiveFilters,
  } = useCalendarFilters()

  // Personal events hook for refresh after event creation
  const { refresh: refreshPersonalEvents } = usePersonalEvents()

  // Date range based on zoom level
  const { dateRange, displayLabel } = useCalendarDates(currentMonth, zoom)

  // Transform data using memoized hook
  const {
    groupedResources,
    eventsByResource,
    personalEventsByResource,
    projects,
    isLoading,
  } = useCalendarData(dateRange, {
    selectedResource,
    selectedProject,
    selectedRoleGroups,
  })

  // Get all resources for filter dropdown
  const allResources = [
    ...groupedResources.gerente,
    ...groupedResources.lider,
    ...groupedResources.operador,
  ]

  // Event handlers
  const handleDayClick = (date: Date, resourceId: string) => {
    setSelectedDate(date)
    setSelectedResourceForEvent(resourceId)
    setShowEventModal(true)
  }

  const handleAddEventClick = () => {
    setSelectedDate(null)
    setSelectedResourceForEvent(null)
    setShowEventModal(true)
  }

  const handlePersonalEventClick = (event: any) => {
    setEditingEvent(event)
    setShowEventModal(true)
  }

  const handleEventModalClose = () => {
    setShowEventModal(false)
    setSelectedDate(null)
    setSelectedResourceForEvent(null)
    setEditingEvent(null)
  }

  const handleEventSuccess = async () => {
    await refreshPersonalEvents()
    handleEventModalClose()
  }

  const handleTaskBarClick = (projectCode: string, resourceId: string, resourceName: string) => {
    // TODO: Open task detail modal
    console.log('Task bar clicked:', projectCode, resourceId, resourceName)
  }

  const handleProjectChange = (projectCode: string | null) => {
    setSelectedProject(projectCode)
  }

  const handleProjectCardClick = (projectCode: string) => {
    // When user clicks a project card, switch to timeline view and filter by that project
    setSelectedProject(projectCode)
    setActiveTab('timeline')
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with filters */}
      <CalendarHeader
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        zoom={zoom}
        onZoomChange={setZoom}
        selectedResource={selectedResource}
        selectedProject={selectedProject}
        resources={allResources}
        projects={projects}
        onResourceChange={setSelectedResource}
        onProjectChange={handleProjectChange}
        onResetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
        onAddEvent={handleAddEventClick}
      />

      {/* Tab navigation (future: Timeline | Projects) */}
      <div className="bg-white border-b">
        <div className="px-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'timeline'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              📊 Timeline por Recurso
            </button>

            {/* Projects tab */}
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'projects'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              🏗️ Visualização por Projeto
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div className="mt-2 text-gray-600">Carregando calendário...</div>
            </div>
          </div>
        ) : activeTab === 'timeline' ? (
          <TimelineView
            dateRange={dateRange}
            groupedResources={groupedResources}
            eventsByResource={eventsByResource}
            personalEventsByResource={personalEventsByResource}
            onDayClick={handleDayClick}
            onTaskBarClick={handleTaskBarClick}
            onPersonalEventClick={handlePersonalEventClick}
          />
        ) : (
          <ProjectsView
            dateRange={dateRange}
            eventsByResource={eventsByResource}
            personalEventsByResource={personalEventsByResource}
            totalResources={allResources.length}
            allResources={allResources}
            onProjectClick={handleProjectCardClick}
          />
        )}
      </div>

      {/* Personal Event Modal */}
      <PersonalEventModal
        isOpen={showEventModal}
        onClose={handleEventModalClose}
        onSuccess={handleEventSuccess}
        resources={allResources}
        selectedResourceId={selectedResourceForEvent || undefined}
        selectedDate={selectedDate || undefined}
        eventToEdit={editingEvent}
      />
    </div>
  )
}
