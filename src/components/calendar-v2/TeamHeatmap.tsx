'use client'

import { useState, useMemo } from 'react'
import { CalendarEvent } from '@/types/allocation.types'
import { PersonalEvent } from '@/types/personal-events.types'
import { formatDateKey, isWeekend, isToday } from '@/utils/calendar/calendar.utils'
import DayDetailModal from './DayDetailModal'

interface TeamHeatmapProps {
  dateRange: Date[]
  eventsByResource: Map<string, CalendarEvent[]>
  personalEventsByResource: Map<string, PersonalEvent[]>
  totalResources: number
  allResources?: Array<{ id: string; name: string }>
}

/**
 * Team availability heatmap
 * Shows daily team workload intensity across the month
 */
export default function TeamHeatmap({
  dateRange,
  eventsByResource,
  personalEventsByResource,
  totalResources,
  allResources = [],
}: TeamHeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  // Calculate daily team metrics
  const dailyMetrics = useMemo(() => {
    return dateRange.map(day => {
      const dayKey = formatDateKey(day)
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)

      let totalTasks = 0
      let resourcesWorking = 0
      let resourcesBlocked = 0

      // Count tasks for this day
      eventsByResource.forEach((events, resourceId) => {
        const tasksOnDay = events.filter(event => {
          const eventStart = new Date(event.startDate)
          const eventEnd = new Date(event.endDate)
          return eventStart <= dayEnd && eventEnd >= dayStart
        })

        if (tasksOnDay.length > 0) {
          totalTasks += tasksOnDay.length
          resourcesWorking++
        }
      })

      // Count blocked resources (with blocking personal events)
      personalEventsByResource.forEach((events, resourceId) => {
        const blockingEvents = events.filter(event => {
          if (!event.blocks_work) return false

          const eventStart = new Date(event.start_date)
          const eventEnd = new Date(event.end_date)
          return eventStart <= dayEnd && eventEnd >= dayStart
        })

        if (blockingEvents.length > 0) {
          resourcesBlocked++
        }
      })

      // Calculate metrics
      const availableResources = totalResources - resourcesBlocked
      const utilizationRate = availableResources > 0 ? (resourcesWorking / availableResources) * 100 : 0
      const avgTasksPerResource = resourcesWorking > 0 ? totalTasks / resourcesWorking : 0

      return {
        date: day,
        dayKey,
        totalTasks,
        resourcesWorking,
        resourcesBlocked,
        availableResources,
        utilizationRate,
        avgTasksPerResource,
        isWeekend: isWeekend(day),
        isToday: isToday(day),
      }
    })
  }, [dateRange, eventsByResource, personalEventsByResource, totalResources])

  // Get color based on utilization rate
  const getUtilizationColor = (utilizationRate: number, avgTasks: number) => {
    // Weekend - gray
    if (utilizationRate === 0 && avgTasks === 0) return 'bg-gray-100 border-gray-200'

    // High load (>80% utilization or 3+ tasks per person)
    if (utilizationRate > 80 || avgTasks >= 3) {
      return 'bg-red-200 border-red-400'
    }

    // Medium-high load (60-80% or 2-3 tasks per person)
    if (utilizationRate > 60 || avgTasks >= 2) {
      return 'bg-orange-200 border-orange-400'
    }

    // Medium load (40-60% or 1-2 tasks per person)
    if (utilizationRate > 40 || avgTasks >= 1) {
      return 'bg-yellow-200 border-yellow-400'
    }

    // Low load (<40% utilization)
    if (utilizationRate > 0) {
      return 'bg-green-200 border-green-400'
    }

    // No tasks
    return 'bg-green-100 border-green-200'
  }

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    const workdays = dailyMetrics.filter(d => !d.isWeekend)
    const totalWorkdays = workdays.length
    const avgUtilization = workdays.reduce((sum, d) => sum + d.utilizationRate, 0) / totalWorkdays
    const peakDay = dailyMetrics.reduce((max, d) => d.totalTasks > max.totalTasks ? d : max, dailyMetrics[0])
    const quietDay = dailyMetrics.filter(d => !d.isWeekend).reduce(
      (min, d) => d.totalTasks < min.totalTasks ? d : min,
      workdays[0] || dailyMetrics[0]
    )

    return {
      avgUtilization,
      peakDay,
      quietDay,
      totalWorkdays,
    }
  }, [dailyMetrics])

  return (
    <>
      <div className="bg-white border rounded-lg p-4">
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            📊 Mapa de Calor da Equipe
          </h3>
          <p className="text-sm text-gray-600">
            Visualização da carga de trabalho diária da equipe • Clique em um dia para ver detalhes
          </p>
        </div>

      {/* Overall stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
          <div className="text-xs text-gray-600 mb-1">Utilização Média</div>
          <div className="text-2xl font-bold text-blue-900">
            {overallStats.avgUtilization.toFixed(0)}%
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded p-3 text-center">
          <div className="text-xs text-gray-600 mb-1">Dias Úteis</div>
          <div className="text-2xl font-bold text-purple-900">
            {overallStats.totalWorkdays}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
          <div className="text-xs text-gray-600 mb-1">Pico de Tarefas</div>
          <div className="text-2xl font-bold text-red-900">
            {overallStats.peakDay?.totalTasks || 0}
          </div>
          <div className="text-[10px] text-gray-500">
            {overallStats.peakDay && `dia ${overallStats.peakDay.date.getDate()}`}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
          <div className="text-xs text-gray-600 mb-1">Dia Mais Tranquilo</div>
          <div className="text-2xl font-bold text-green-900">
            {overallStats.quietDay?.totalTasks || 0}
          </div>
          <div className="text-[10px] text-gray-500">
            {overallStats.quietDay && `dia ${overallStats.quietDay.date.getDate()}`}
          </div>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="mb-4">
        {/* Day of week headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-gray-600 py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dailyMetrics.map((metric, index) => {
            const color = getUtilizationColor(metric.utilizationRate, metric.avgTasksPerResource)
            const day = metric.date.getDate()

            return (
              <div
                key={metric.dayKey}
                className={`
                  ${color} border-2 rounded p-2 text-center
                  ${metric.isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                  ${metric.isWeekend ? 'opacity-50' : ''}
                  hover:shadow-lg hover:scale-105 transition-all cursor-pointer relative
                `}
                onClick={() => setSelectedDay(metric.date)}
                title="Clique para ver detalhes do dia"
              >
                {/* Day number */}
                <div className="text-sm font-bold text-gray-900">{day}</div>

                {/* Task count */}
                <div className="text-xs text-gray-700 mt-1 font-medium">
                  📋 {metric.totalTasks}
                </div>

                {/* Resources working */}
                <div className="text-[10px] text-gray-600">
                  👥 {metric.resourcesWorking}
                </div>

                {/* Blocked resources indicator */}
                {metric.resourcesBlocked > 0 && (
                  <div className="text-[10px] text-red-700 font-bold mt-1">
                    🚫 {metric.resourcesBlocked}
                  </div>
                )}

                {/* Today indicator */}
                {metric.isToday && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t pt-4 space-y-3">
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">💡 Como ler o mapa:</div>
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">📋</span>
              <span>Total de tarefas no dia</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">👥</span>
              <span>Recursos trabalhando</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">🚫</span>
              <span>Recursos bloqueados</span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">🎨 Cores (carga de trabalho):</div>
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 bg-green-100 border-2 border-green-200 rounded"></div>
              <span className="text-center text-gray-900">Vazio<br/>(0%)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 bg-green-200 border-2 border-green-400 rounded"></div>
              <span className="text-center text-gray-900">Baixo<br/>(&lt;40%)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 bg-yellow-200 border-2 border-yellow-400 rounded"></div>
              <span className="text-center text-gray-900">Médio<br/>(40-60%)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 bg-orange-200 border-2 border-orange-400 rounded"></div>
              <span className="text-center text-gray-900">Alto<br/>(60-80%)</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 bg-red-200 border-2 border-red-400 rounded"></div>
              <span className="text-center text-gray-900">Crítico<br/>(&gt;80%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Day detail modal */}
      <DayDetailModal
        isOpen={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        date={selectedDay}
        eventsByResource={eventsByResource}
        personalEventsByResource={personalEventsByResource}
        totalResources={totalResources}
        allResources={allResources}
      />
    </>
  )
}
