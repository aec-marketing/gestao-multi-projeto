'use client'

import { TimelineZoom } from './TimelineZoomControl'

interface MonthNavigatorProps {
  currentMonth: Date
  zoom?: TimelineZoom
  onMonthChange: (newMonth: Date) => void
}

function navigate(date: Date, zoom: TimelineZoom, delta: number): Date {
  const d = new Date(date)
  switch (zoom) {
    case 'day':   d.setDate(d.getDate() + delta); break
    case 'week':  d.setDate(d.getDate() + delta * 7); break
    case 'year':  d.setFullYear(d.getFullYear() + delta); break
    case 'month':
    default:      d.setMonth(d.getMonth() + delta); break
  }
  return d
}

function formatLabel(date: Date, zoom: TimelineZoom): string {
  switch (zoom) {
    case 'day':
      return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    case 'week': {
      // Domingo da semana
      const d = new Date(date)
      d.setDate(d.getDate() - d.getDay())
      const end = new Date(d)
      end.setDate(d.getDate() + 6)
      const startStr = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      const endStr = end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      return `${startStr} – ${endStr}`
    }
    case 'year':
      return String(date.getFullYear())
    case 'month':
    default:
      return date.toLocaleDateString('pt-BR', { month: 'long' })
  }
}

function isCurrentPeriod(date: Date, zoom: TimelineZoom): boolean {
  const today = new Date()
  switch (zoom) {
    case 'day':
      return date.toDateString() === today.toDateString()
    case 'week': {
      const d = new Date(date)
      d.setDate(d.getDate() - d.getDay())
      const t = new Date(today)
      t.setDate(t.getDate() - t.getDay())
      return d.toDateString() === t.toDateString()
    }
    case 'year':
      return date.getFullYear() === today.getFullYear()
    case 'month':
    default:
      return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
  }
}

/**
 * Navegação de período — avança/recua por dia, semana, mês ou ano conforme o zoom.
 */
export default function MonthNavigator({ currentMonth, zoom = 'month', onMonthChange }: MonthNavigatorProps) {
  const today = new Date()
  const isCurrent = isCurrentPeriod(currentMonth, zoom)
  const currentYear = currentMonth.getFullYear()
  const baseYear = today.getFullYear()
  const years = Array.from({ length: 7 }, (_, i) => baseYear - 3 + i)

  const handleYearChange = (year: number) => {
    const d = new Date(currentMonth)
    d.setFullYear(year)
    onMonthChange(d)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onMonthChange(navigate(currentMonth, zoom, -1))}
        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title="Período anterior"
      >
        ←
      </button>

      <h2 className="text-base font-semibold text-gray-900 min-w-[140px] text-center capitalize">
        {formatLabel(currentMonth, zoom)}
      </h2>

      <button
        onClick={() => onMonthChange(navigate(currentMonth, zoom, +1))}
        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title="Próximo período"
      >
        →
      </button>

      {/* Seletor de ano — visível apenas nos zooms mês/ano */}
      {(zoom === 'month' || zoom === 'year') && (
        <select
          value={currentYear}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          className="px-2 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-colors"
          title="Selecionar ano"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      )}

      {!isCurrent && (
        <button
          onClick={() => onMonthChange(new Date())}
          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
          title="Voltar para o período atual"
        >
          Hoje
        </button>
      )}
    </div>
  )
}
