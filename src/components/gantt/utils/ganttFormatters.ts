/**
 * Formatação visual de dados para o Gantt
 * ONDA 2: Integrado com sistema de minutos
 */

import { formatMinutes } from '@/utils/time.utils'
import { formatDateBR } from '@/utils/date.utils'
import { WorkType } from '@/utils/workType.utils'
import { TaskWithDates } from '../types/gantt.types'

/**
 * Labels amigáveis para work_type (ONDA 3)
 */
export const workTypeLabels: Record<WorkType, string> = {
  work: '⚙️ Produção',
  wait: '⏳ Dependência',
  milestone: '🎯 Checkpoint'
}

/**
 * Formata duração de tarefa em formato compacto ou completo
 * @param minutes - Duração em minutos
 * @param format - 'compact' (ex: "1.5d") ou 'full' (ex: "1 dia e 4 horas")
 */
export function formatTaskDuration(
  minutes: number,
  format: 'compact' | 'full' = 'compact'
): string {
  return formatMinutes(minutes, format === 'compact' ? 'short' : 'long')
}

/**
 * Gera tooltip completo para barra de tarefa (versão simples para title)
 * @param task - Tarefa com datas processadas
 */
export function formatTaskTooltip(task: TaskWithDates): string {
  const lines = [
    `📋 ${task.name}`,
    '',
    `⏱️ Duração: ${formatMinutes(task.duration_minutes, 'auto')}`,
    `   (${task.duration_minutes} min | ${formatMinutes(task.duration_minutes, 'short')})`,
    `🏷️ Categoria: ${workTypeLabels[task.work_type] || 'N/A'}`,
    `📅 Início: ${formatDateBR(task.start_date)}`,
    `📅 Fim: ${formatDateBR(task.end_date)}`,
    `📊 Progresso: ${task.progress}%`
  ]

  return lines.join('\n')
}

/**
 * Gera dados do tooltip para renderização HTML customizada
 */
export function formatTaskTooltipData(task: TaskWithDates) {
  return {
    name: task.name,
    duration: {
      minutes: task.duration_minutes,
      auto: formatMinutes(task.duration_minutes, 'auto'),
      short: formatMinutes(task.duration_minutes, 'short'),
      long: formatMinutes(task.duration_minutes, 'long')
    },
    workType: workTypeLabels[task.work_type] || 'N/A',
    startDate: formatDateBR(task.start_date),
    endDate: formatDateBR(task.end_date),
    progress: task.progress
  }
}

/**
 * Formata intervalo de datas para exibição
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  return `${formatDateBR(startDate)} - ${formatDateBR(endDate)}`
}
