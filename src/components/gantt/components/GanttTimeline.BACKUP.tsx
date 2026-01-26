/**
 * Grid de datas do Gantt (timeline horizontal)
 */

import React from 'react'
import { ZoomLevel } from '../types/gantt.types'

interface GanttTimelineProps {
  dateGrid: Date[]
  columnWidth: number
  zoomLevel: ZoomLevel
  selectedDay: string | null
  onDayClick: (day: string) => void
}

export function GanttTimeline({
  dateGrid,
  columnWidth,
  zoomLevel,
  selectedDay,
  onDayClick
}: GanttTimelineProps) {
  const formatDate = (date: Date, zoom: ZoomLevel): string => {
    const day = date.getDate()
    const month = date.getMonth() + 1
    const year = date.getFullYear()

    if (zoom === 'day') {
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`
    } else if (zoom === 'week') {
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`
    } else {
      return `${month.toString().padStart(2, '0')}/${year}`
    }
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  return (
    <div className="flex border-b bg-gray-50 sticky top-0 z-20">
      {/* Coluna fixa esquerda (nome das tarefas) */}
      <div className="w-80 border-r bg-gray-100 flex items-center justify-center px-2 py-2 sticky left-0 z-30">
        <span className="text-xs font-semibold text-gray-600">TAREFAS</span>
      </div>

      {/* Grid de datas */}
      <div className="flex">
        {dateGrid.map((date, index) => {
          const dateStr = date.toISOString().split('T')[0]
          const isSelectedDay = dateStr === selectedDay
          const isTodayDate = isToday(date)
          const isWeekendDate = isWeekend(date)

          return (
            <div
              key={index}
              style={{ width: `${columnWidth}px` }}
              className={`
                border-r border-gray-200 px-1 py-2 text-center cursor-pointer
                transition-colors
                ${isSelectedDay ? 'bg-blue-100 font-bold' : ''}
                ${isTodayDate ? 'bg-green-100 border-green-400 border-2' : ''}
                ${isWeekendDate ? 'bg-gray-100' : 'bg-white'}
                hover:bg-blue-50
              `}
              onClick={() => onDayClick(dateStr)}
              title={date.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            >
              <div className="text-[10px] font-medium text-gray-700">
                {formatDate(date, zoomLevel)}
              </div>
              {isTodayDate && (
                <div className="text-[8px] text-green-700 font-bold mt-0.5">HOJE</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
