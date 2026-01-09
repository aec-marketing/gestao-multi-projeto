'use client'

import { previousMonth, nextMonth, getCurrentMonth, formatMonthName } from '@/utils/calendar/calendar.utils'

interface MonthNavigatorProps {
  currentMonth: Date
  onMonthChange: (newMonth: Date) => void
}

/**
 * Month navigation controls
 * Allows user to move between months and jump to current month
 */
export default function MonthNavigator({ currentMonth, onMonthChange }: MonthNavigatorProps) {
  const handlePreviousMonth = () => {
    onMonthChange(previousMonth(currentMonth))
  }

  const handleNextMonth = () => {
    onMonthChange(nextMonth(currentMonth))
  }

  const handleToday = () => {
    onMonthChange(getCurrentMonth())
  }

  const monthName = formatMonthName(currentMonth)
  const isCurrentMonth =
    currentMonth.getFullYear() === new Date().getFullYear() &&
    currentMonth.getMonth() === new Date().getMonth()

  return (
    <div className="flex items-center gap-3">
      {/* Previous Month Button */}
      <button
        onClick={handlePreviousMonth}
        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title="Mês anterior"
      >
        ← Anterior
      </button>

      {/* Current Month Display */}
      <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center capitalize">
        {monthName}
      </h2>

      {/* Next Month Button */}
      <button
        onClick={handleNextMonth}
        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title="Próximo mês"
      >
        Próximo →
      </button>

      {/* Today Button (only show if not in current month) */}
      {!isCurrentMonth && (
        <button
          onClick={handleToday}
          className="ml-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
          title="Voltar para o mês atual"
        >
          Hoje
        </button>
      )}
    </div>
  )
}
