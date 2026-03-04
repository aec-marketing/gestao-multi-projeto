'use client'

import { useState, useMemo } from 'react'
import { CalendarEvent } from '@/types/allocation.types'
import { PersonalEvent } from '@/types/personal-events.types'
import { formatDateKey, isWeekend, isToday } from '@/utils/calendar/calendar.utils'
import DayDetailModal from './DayDetailModal'

type HeatmapZoom = 'day' | 'week' | 'month' | 'year'

interface TeamHeatmapProps {
  dateRange: Date[]           // ainda recebido mas não usado — mantido para compatibilidade
  currentMonth: Date          // mês base para navegação interna
  eventsByResource: Map<string, CalendarEvent[]>
  personalEventsByResource: Map<string, PersonalEvent[]>
  totalResources: number
  allResources?: Array<{ id: string; name: string }>
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function generateMonthDays(ref: Date): Date[] {
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const last = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: last }, (_, i) => new Date(year, month, i + 1, 0, 0, 0, 0))
}

function generateWeekDays(ref: Date): Date[] {
  const d = new Date(ref)
  const dow = d.getDay() // 0=Dom
  d.setDate(d.getDate() - dow) // vai para o Domingo da semana
  d.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    return day
  })
}

function generateYearMonths(ref: Date): Date[] {
  const year = ref.getFullYear()
  return Array.from({ length: 12 }, (_, i) => new Date(year, i, 1, 0, 0, 0, 0))
}

function navigateRef(ref: Date, zoom: HeatmapZoom, delta: number): Date {
  const d = new Date(ref)
  switch (zoom) {
    case 'day':
      d.setDate(d.getDate() + delta)
      break
    case 'week':
      d.setDate(d.getDate() + delta * 7)
      break
    case 'month':
      d.setMonth(d.getMonth() + delta)
      break
    case 'year':
      d.setFullYear(d.getFullYear() + delta)
      break
  }
  return d
}

function labelFor(ref: Date, zoom: HeatmapZoom): string {
  switch (zoom) {
    case 'day':
      return ref.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    case 'week': {
      const days = generateWeekDays(ref)
      const start = days[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      const end = days[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
      return `${start} – ${end}`
    }
    case 'month':
      return ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    case 'year':
      return String(ref.getFullYear())
  }
}

// ─── métricas por dia ──────────────────────────────────────────────────────────

function computeDayMetrics(
  days: Date[],
  eventsByResource: Map<string, CalendarEvent[]>,
  personalEventsByResource: Map<string, PersonalEvent[]>,
  totalResources: number,
) {
  return days.map(day => {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)

    let totalTasks = 0
    let resourcesWorking = 0
    let resourcesBlocked = 0

    eventsByResource.forEach(events => {
      const tasksOnDay = events.filter(e => new Date(e.startDate) <= dayEnd && new Date(e.endDate) >= dayStart)
      if (tasksOnDay.length > 0) { totalTasks += tasksOnDay.length; resourcesWorking++ }
    })

    personalEventsByResource.forEach(events => {
      const blocked = events.some(e => e.blocks_work && new Date(e.start_date) <= dayEnd && new Date(e.end_date) >= dayStart)
      if (blocked) resourcesBlocked++
    })

    const availableResources = totalResources - resourcesBlocked
    const utilizationRate = availableResources > 0 ? (resourcesWorking / availableResources) * 100 : 0
    const avgTasksPerResource = resourcesWorking > 0 ? totalTasks / resourcesWorking : 0

    return {
      date: day,
      dayKey: formatDateKey(day),
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
}

// métricas agregadas por mês (para zoom anual)
function computeMonthMetrics(
  year: number,
  eventsByResource: Map<string, CalendarEvent[]>,
  personalEventsByResource: Map<string, PersonalEvent[]>,
  totalResources: number,
) {
  return Array.from({ length: 12 }, (_, m) => {
    const monthStart = new Date(year, m, 1)
    const monthEnd = new Date(year, m + 1, 0, 23, 59, 59)

    let totalTasks = 0
    let workingDaysWithTasks = 0
    let resourcesBlockedDays = 0

    eventsByResource.forEach(events => {
      const tasksInMonth = events.filter(e => new Date(e.startDate) <= monthEnd && new Date(e.endDate) >= monthStart)
      totalTasks += tasksInMonth.length
      if (tasksInMonth.length > 0) workingDaysWithTasks++
    })

    personalEventsByResource.forEach(events => {
      const blocked = events.filter(e => e.blocks_work && new Date(e.start_date) <= monthEnd && new Date(e.end_date) >= monthStart)
      resourcesBlockedDays += blocked.length
    })

    const utilizationRate = totalResources > 0 ? (workingDaysWithTasks / totalResources) * 100 : 0

    return {
      month: monthStart,
      monthKey: `${year}-${String(m + 1).padStart(2, '0')}`,
      monthName: monthStart.toLocaleDateString('pt-BR', { month: 'short' }),
      fullMonthName: monthStart.toLocaleDateString('pt-BR', { month: 'long' }),
      totalTasks,
      utilizationRate,
      resourcesBlockedDays,
    }
  })
}

// ─── cores ────────────────────────────────────────────────────────────────────

function getUtilizationColor(utilizationRate: number, avgTasks: number) {
  if (utilizationRate === 0 && avgTasks === 0) return 'bg-gray-100 border-gray-200'
  if (utilizationRate > 80 || avgTasks >= 3) return 'bg-red-200 border-red-400'
  if (utilizationRate > 60 || avgTasks >= 2) return 'bg-orange-200 border-orange-400'
  if (utilizationRate > 40 || avgTasks >= 1) return 'bg-yellow-200 border-yellow-400'
  if (utilizationRate > 0) return 'bg-green-200 border-green-400'
  return 'bg-green-100 border-green-200'
}

function getMonthColor(utilizationRate: number) {
  if (utilizationRate > 80) return 'bg-red-200 border-red-400'
  if (utilizationRate > 60) return 'bg-orange-200 border-orange-400'
  if (utilizationRate > 40) return 'bg-yellow-200 border-yellow-400'
  if (utilizationRate > 0)  return 'bg-green-200 border-green-400'
  return 'bg-gray-100 border-gray-200'
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function TeamHeatmap({
  dateRange,
  currentMonth,
  eventsByResource,
  personalEventsByResource,
  totalResources,
  allResources = [],
}: TeamHeatmapProps) {
  const [zoom, setZoom] = useState<HeatmapZoom>('month')
  const [ref, setRef] = useState<Date>(() => new Date(currentMonth))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // Dias/meses a exibir
  const days = useMemo(() => {
    if (zoom === 'month') return generateMonthDays(ref)
    if (zoom === 'week')  return generateWeekDays(ref)
    if (zoom === 'day')   return [new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())]
    return [] // ano usa monthMetrics
  }, [zoom, ref])

  const dayMetrics = useMemo(() => {
    if (zoom === 'year') return []
    return computeDayMetrics(days, eventsByResource, personalEventsByResource, totalResources)
  }, [days, zoom, eventsByResource, personalEventsByResource, totalResources])

  const monthMetrics = useMemo(() => {
    if (zoom !== 'year') return []
    return computeMonthMetrics(ref.getFullYear(), eventsByResource, personalEventsByResource, totalResources)
  }, [zoom, ref, eventsByResource, personalEventsByResource, totalResources])

  // Estatísticas gerais
  const overallStats = useMemo(() => {
    if (zoom === 'year') {
      const total = monthMetrics.reduce((s, m) => s + m.totalTasks, 0)
      const peak = monthMetrics.reduce((mx, m) => m.totalTasks > mx.totalTasks ? m : mx, monthMetrics[0])
      return { label: 'Tarefas no Ano', value: total, peakLabel: peak?.fullMonthName ?? '-', peakValue: peak?.totalTasks ?? 0 }
    }
    const workdays = dayMetrics.filter(d => !d.isWeekend)
    const avg = workdays.length > 0 ? workdays.reduce((s, d) => s + d.utilizationRate, 0) / workdays.length : 0
    const peak = dayMetrics.reduce((mx, d) => d.totalTasks > mx.totalTasks ? d : mx, dayMetrics[0] ?? { totalTasks: 0, date: new Date() })
    return { label: 'Utilização Média', value: avg, peakLabel: peak?.date ? `dia ${peak.date.getDate()}` : '-', peakValue: peak?.totalTasks ?? 0, isPercent: true }
  }, [zoom, dayMetrics, monthMetrics])

  const ZOOM_LABELS: Record<HeatmapZoom, string> = { day: 'Dia', week: 'Semana', month: 'Mês', year: 'Ano' }
  const WEEK_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const MONTH_HEADERS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  return (
    <>
      <div className="bg-white border rounded-lg">
        {/* ── Cabeçalho fixo (sticky) ── */}
        <div className="sticky top-0 z-10 bg-white border-b rounded-t-lg px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">📊 Mapa de Calor da Equipe</h3>
            <p className="text-sm text-gray-600">
              Carga de trabalho diária • Clique em um dia para ver detalhes
            </p>
          </div>

          {/* Controles de zoom + navegação */}
          <div className="flex items-center gap-3">
            {/* Seletor de zoom */}
            <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
              {(Object.keys(ZOOM_LABELS) as HeatmapZoom[]).map(z => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    zoom === z ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {ZOOM_LABELS[z]}
                </button>
              ))}
            </div>

            {/* Navegação anterior/próximo */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRef(navigateRef(ref, zoom, -1))}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                title="Anterior"
              >
                ‹
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">
                {labelFor(ref, zoom)}
              </span>
              <button
                onClick={() => setRef(navigateRef(ref, zoom, +1))}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                title="Próximo"
              >
                ›
              </button>
            </div>

            {/* Botão "Hoje" */}
            <button
              onClick={() => setRef(new Date())}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
        </div>{/* fim sticky */}

        {/* ── Conteúdo scrollável ── */}
        <div className="p-4">

        {/* ── Estatísticas gerais ── */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
            <div className="text-xs text-gray-600 mb-1">
              {overallStats.isPercent ? 'Utilização Média' : 'Tarefas no Período'}
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {overallStats.isPercent ? `${overallStats.value.toFixed(0)}%` : overallStats.value}
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
            <div className="text-xs text-gray-600 mb-1">Pico de Tarefas</div>
            <div className="text-2xl font-bold text-red-900">{overallStats.peakValue}</div>
            <div className="text-[10px] text-gray-500">{overallStats.peakLabel}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded p-3 text-center">
            <div className="text-xs text-gray-600 mb-1">Recursos Totais</div>
            <div className="text-2xl font-bold text-purple-900">{totalResources}</div>
          </div>
        </div>

        {/* ── Grade ── */}
        <div className="mb-4">

          {/* ZOOM: MÊS — grade 7 colunas com offset */}
          {zoom === 'month' && (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEK_HEADERS.map(h => (
                  <div key={h} className="text-center text-xs font-semibold text-gray-600 py-1">{h}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: dayMetrics[0]?.date.getDay() ?? 0 }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {dayMetrics.map(metric => (
                  <DayCell key={metric.dayKey} metric={metric} onClick={setSelectedDay} />
                ))}
              </div>
            </>
          )}

          {/* ZOOM: SEMANA — 7 colunas Dom-Sáb */}
          {zoom === 'week' && (
            <>
              <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEK_HEADERS.map(h => (
                  <div key={h} className="text-center text-xs font-semibold text-gray-600 py-1">{h}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {dayMetrics.map(metric => (
                  <DayCell key={metric.dayKey} metric={metric} onClick={setSelectedDay} large />
                ))}
              </div>
            </>
          )}

          {/* ZOOM: DIA — card único centralizado */}
          {zoom === 'day' && dayMetrics[0] && (
            <div className="flex justify-center">
              <DayCell metric={dayMetrics[0]} onClick={setSelectedDay} xlarge />
            </div>
          )}

          {/* ZOOM: ANO — grade 4x3 com nomes de mês */}
          {zoom === 'year' && (
            <>
              <div className="grid grid-cols-4 gap-3">
                {monthMetrics.map(m => {
                  const color = getMonthColor(m.utilizationRate)
                  return (
                    <div
                      key={m.monthKey}
                      className={`${color} border-2 rounded-lg p-3 text-center cursor-pointer hover:shadow-md transition-all`}
                      onClick={() => { setZoom('month'); setRef(m.month) }}
                      title={`${m.fullMonthName} — clique para ver o mês`}
                    >
                      <div className="text-sm font-bold text-gray-900 capitalize">{m.fullMonthName}</div>
                      <div className="text-xs text-gray-700 mt-1">📋 {m.totalTasks} tarefas</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {m.utilizationRate.toFixed(0)}% utilização
                      </div>
                      {m.resourcesBlockedDays > 0 && (
                        <div className="text-[10px] text-red-700 font-bold mt-1">🚫 {m.resourcesBlockedDays}</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">Clique em um mês para ver o detalhamento diário</p>
            </>
          )}
        </div>

        {/* ── Legenda ── */}
        <div className="border-t pt-4 space-y-3">
          <div>
            <div className="text-xs font-medium text-gray-700 mb-2">💡 Como ler o mapa:</div>
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-1.5"><span className="font-semibold">📋</span><span>Total de tarefas no dia</span></div>
              <div className="flex items-center gap-1.5"><span className="font-semibold">👥</span><span>Recursos trabalhando</span></div>
              <div className="flex items-center gap-1.5"><span className="font-semibold">🚫</span><span>Recursos bloqueados</span></div>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-700 mb-2">🎨 Cores (carga de trabalho):</div>
            <div className="grid grid-cols-5 gap-2 text-xs">
              {[
                { bg: 'bg-gray-100 border-gray-200',     label: 'Vazio\n(0%)' },
                { bg: 'bg-green-100 border-green-200',   label: 'Livre\n(0%)' },
                { bg: 'bg-yellow-200 border-yellow-400', label: 'Médio\n(40-60%)' },
                { bg: 'bg-orange-200 border-orange-400', label: 'Alto\n(60-80%)' },
                { bg: 'bg-red-200 border-red-400',       label: 'Crítico\n(>80%)' },
              ].map(({ bg, label }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 ${bg} border-2 rounded`} />
                  <span className="text-center text-gray-900 whitespace-pre-line leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>{/* fim conteúdo scrollável */}
      </div>

      {/* Modal de detalhe do dia */}
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

// ─── sub-componente célula de dia ──────────────────────────────────────────────

interface DayCellProps {
  metric: ReturnType<typeof computeDayMetrics>[number]
  onClick: (date: Date) => void
  large?: boolean
  xlarge?: boolean
}

function DayCell({ metric, onClick, large, xlarge }: DayCellProps) {
  const color = getUtilizationColor(metric.utilizationRate, metric.avgTasksPerResource)
  const sizeClass = xlarge ? 'p-6 min-w-[180px]' : large ? 'p-3' : 'p-2'

  return (
    <div
      className={`
        ${color} border-2 rounded ${sizeClass} text-center
        ${metric.isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        ${metric.isWeekend ? 'opacity-50' : ''}
        hover:shadow-lg hover:scale-105 transition-all cursor-pointer relative
      `}
      onClick={() => onClick(metric.date)}
      title="Clique para ver detalhes do dia"
    >
      <div className={`font-bold text-gray-900 ${xlarge ? 'text-2xl' : large ? 'text-base' : 'text-sm'}`}>
        {metric.date.getDate()}
      </div>
      {xlarge && (
        <div className="text-xs text-gray-600 mb-2">
          {metric.date.toLocaleDateString('pt-BR', { weekday: 'long', month: 'long', year: 'numeric' })}
        </div>
      )}
      <div className={`text-gray-700 font-medium ${xlarge ? 'text-sm mt-2' : 'text-xs mt-1'}`}>
        📋 {metric.totalTasks}
      </div>
      <div className={`text-gray-600 ${xlarge ? 'text-xs mt-1' : 'text-[10px]'}`}>
        👥 {metric.resourcesWorking}
      </div>
      {metric.resourcesBlocked > 0 && (
        <div className={`text-red-700 font-bold ${xlarge ? 'text-xs mt-2' : 'text-[10px] mt-1'}`}>
          🚫 {metric.resourcesBlocked}
        </div>
      )}
      {metric.isToday && (
        <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
      )}
    </div>
  )
}
