'use client'

import { useMemo } from 'react'
import { CalendarEvent } from '@/types/allocation.types'
import { formatDateBR } from '@/utils/date.utils'

interface ProjectCardProps {
  projectCode: string
  projectName: string
  events: CalendarEvent[]
  dateRange: Date[]
  onProjectClick?: (projectCode: string) => void
}

/**
 * Project card showing team allocation summary
 * Displays project info, team members, and busy days indicator
 */
export default function ProjectCard({
  projectCode,
  projectName,
  events,
  dateRange,
  onProjectClick,
}: ProjectCardProps) {
  // Get unique team members working on this project
  const teamMembers = useMemo(() => {
    const uniqueMembers = new Map<string, { name: string; taskCount: number }>()

    events.forEach(event => {
      const existing = uniqueMembers.get(event.resourceId)
      if (existing) {
        existing.taskCount++
      } else {
        uniqueMembers.set(event.resourceId, {
          name: event.resourceName,
          taskCount: 1,
        })
      }
    })

    return Array.from(uniqueMembers.values()).sort((a, b) => {
      // Sort by name
      return a.name.localeCompare(b.name)
    })
  }, [events])

  // Calculate busy days (days with at least one task)
  const busyDays = useMemo(() => {
    const daysWithTasks = new Set<string>()

    events.forEach(event => {
      const startDate = new Date(event.startDate)
      const endDate = new Date(event.endDate)

      dateRange.forEach(day => {
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)

        if (startDate <= dayEnd && endDate >= dayStart) {
          daysWithTasks.add(day.toISOString().split('T')[0])
        }
      })
    })

    return daysWithTasks.size
  }, [events, dateRange])

  // Calculate total task count
  const totalTasks = events.length

  // Get date range for this project
  const projectDateRange = useMemo(() => {
    if (events.length === 0) return null

    const startDates = events.map(e => new Date(e.startDate))
    const endDates = events.map(e => new Date(e.endDate))

    const earliest = new Date(Math.min(...startDates.map(d => d.getTime())))
    const latest = new Date(Math.max(...endDates.map(d => d.getTime())))

    return { start: earliest, end: latest }
  }, [events])

  // Calculate workload intensity (tasks per day)
  const workloadIntensity = busyDays > 0 ? totalTasks / busyDays : 0
  const getIntensityColor = () => {
    if (workloadIntensity >= 2) return 'bg-red-100 border-red-300 text-red-800'
    if (workloadIntensity >= 1.5) return 'bg-orange-100 border-orange-300 text-orange-800'
    if (workloadIntensity >= 1) return 'bg-yellow-100 border-yellow-300 text-yellow-800'
    return 'bg-green-100 border-green-300 text-green-800'
  }

  // Get priority distribution
  const priorityDistribution = useMemo(() => {
    const counts = { alta: 0, media: 0, baixa: 0 }
    events.forEach(event => {
      counts[event.priority]++
    })
    return counts
  }, [events])

  return (
    <div
      className={`
        bg-white border-2 border-gray-200 rounded-lg p-4
        hover:shadow-lg transition-all cursor-pointer
        ${onProjectClick ? 'hover:border-blue-400' : ''}
      `}
      onClick={() => onProjectClick?.(projectCode)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900 truncate">
            {projectCode}
          </h3>
          <p className="text-sm text-gray-600 truncate" title={projectName}>
            {projectName}
          </p>
        </div>

        {/* Workload intensity badge */}
        <div className={`ml-2 px-2 py-1 rounded text-xs font-medium border ${getIntensityColor()}`}>
          {workloadIntensity >= 2 ? '🔥 Alta' : workloadIntensity >= 1.5 ? '⚡ Média-Alta' : workloadIntensity >= 1 ? '📊 Média' : '✅ Baixa'}
        </div>
      </div>

      {/* Date range */}
      {projectDateRange && (
        <div className="mb-3 text-sm text-gray-600">
          📅 {formatDateBR(projectDateRange.start)} - {formatDateBR(projectDateRange.end)}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
          <div className="text-xs text-gray-600">Equipe</div>
          <div className="text-lg font-bold text-blue-900">{teamMembers.length}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
          <div className="text-xs text-gray-600">Tarefas</div>
          <div className="text-lg font-bold text-purple-900">{totalTasks}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
          <div className="text-xs text-gray-600">Dias Ativos</div>
          <div className="text-lg font-bold text-green-900">{busyDays}</div>
        </div>
      </div>

      {/* Priority distribution */}
      <div className="mb-3 pb-3 border-b">
        <div className="text-xs text-gray-600 mb-1">Prioridades:</div>
        <div className="flex gap-2 text-xs">
          {priorityDistribution.alta > 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded border border-red-300">
              🔴 Alta: {priorityDistribution.alta}
            </span>
          )}
          {priorityDistribution.media > 0 && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded border border-yellow-300">
              🟡 Média: {priorityDistribution.media}
            </span>
          )}
          {priorityDistribution.baixa > 0 && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded border border-green-300">
              🟢 Baixa: {priorityDistribution.baixa}
            </span>
          )}
        </div>
      </div>

      {/* Team members list */}
      <div>
        <div className="text-xs text-gray-600 mb-2">Equipe ({teamMembers.length}):</div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {teamMembers.map(member => (
            <div key={member.name} className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1 rounded">
              <span className="font-medium text-gray-900 truncate flex-1">
                👤 {member.name}
              </span>
              <span className="text-gray-500 ml-2">
                {member.taskCount} {member.taskCount === 1 ? 'tarefa' : 'tarefas'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
