'use client'

import { isToday, isWeekend, getShortDayName } from '@/utils/calendar/calendar.utils'

interface TimelineHeaderProps {
  dateRange: Date[]
}

/**
 * Timeline header showing day names and dates
 * Sticky header that stays visible when scrolling
 */
export default function TimelineHeader({ dateRange }: TimelineHeaderProps) {
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
              style={{ minWidth: '50px' }}
            >
              {/* Day name (Dom, Seg, Ter...) */}
              <div
                className={`
                  font-medium text-xs uppercase
                  ${isTodayCell ? 'text-blue-600 font-bold' : 'text-gray-700'}
                `}
              >
                {getShortDayName(day)}
              </div>

              {/* Date number */}
              <div
                className={`
                  text-lg font-semibold mt-1
                  ${isTodayCell ? 'text-blue-600' : 'text-gray-900'}
                `}
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
