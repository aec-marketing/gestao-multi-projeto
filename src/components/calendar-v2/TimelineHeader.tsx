'use client'

import { isToday, isWeekend, getShortDayName } from '@/utils/calendar/calendar.utils'
import { TimelineZoom } from './TimelineZoomControl'

interface TimelineHeaderProps {
  dateRange: Date[]
  zoom?: TimelineZoom
}

const SHORT_MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Timeline header showing day names and dates (or month names in year view)
 * Sticky header that stays visible when scrolling
 */
export default function TimelineHeader({ dateRange, zoom = 'month' }: TimelineHeaderProps) {
  const today = new Date()

  if (zoom === 'year') {
    return (
      <div className="flex border-b bg-gray-50 sticky top-0 z-40 shadow-sm">
        <div className="sticky left-0 z-50 bg-gray-50 border-r w-[240px] p-3 flex items-center justify-center flex-shrink-0">
          <span className="font-semibold text-gray-700">Recurso</span>
        </div>
        <div className="flex-1 flex">
          {dateRange.map((month, index) => {
            const isCurrentMonth =
              month.getFullYear() === today.getFullYear() &&
              month.getMonth() === today.getMonth()

            return (
              <div
                key={index}
                className={`flex-1 p-2 border-r text-center ${isCurrentMonth ? 'bg-blue-100' : ''}`}
                style={{ minWidth: '60px' }}
              >
                <div className={`font-semibold text-sm ${isCurrentMonth ? 'text-blue-600' : 'text-gray-800'}`}>
                  {SHORT_MONTH_NAMES[month.getMonth()]}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex border-b bg-gray-50 sticky top-0 z-40 shadow-sm">
      {/* Fixed left column - "Recurso" label */}
      <div className="sticky left-0 z-50 bg-gray-50 border-r w-[240px] p-3 flex items-center justify-center flex-shrink-0">
        <span className="font-semibold text-gray-700">Recurso</span>
      </div>

      {/* Day headers */}
      <div className="flex-1 flex">
        {dateRange.map((day, index) => {
          const isTodayCell = isToday(day)
          const isWeekendCell = isWeekend(day)

          return (
            <div
              key={index}
              className={`
                flex-1 p-3 border-r text-center
                ${isTodayCell ? 'bg-blue-100' : ''}
                ${isWeekendCell ? 'bg-gray-100' : ''}
              `}
              style={{ minWidth: zoom === 'week' ? '120px' : zoom === 'day' ? '200px' : '50px' }}
            >
              <div className={`font-medium text-xs uppercase ${isTodayCell ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                {getShortDayName(day)}
              </div>
              <div className={`text-lg font-semibold mt-1 ${isTodayCell ? 'text-blue-600' : 'text-gray-900'}`}>
                {day.getDate()}
              </div>
              {/* Para zoom dia/semana, mostra o mês abaixo */}
              {(zoom === 'day' || zoom === 'week') && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {day.toLocaleDateString('pt-BR', { month: 'short' })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
