/**
 * Utilitários para sincronizar datas e duração de tarefas
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Parse seguro de data string para evitar problemas de timezone
 */
export function parseLocalDate(dateStr: string | null): Date | null {
  if (!dateStr) return null

  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return null

  return new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2])
  )
}

/**
 * Calcula duração baseado em start_date e end_date
 * Retorna número de dias incluindo o dia inicial
 */
export function calculateDurationFromDates(
  startDate: string | Date,
  endDate: string | Date
): number {
  const start = typeof startDate === 'string' ? parseLocalDate(startDate) : startDate
  const end = typeof endDate === 'string' ? parseLocalDate(endDate) : endDate

  if (!start || !end) return 1

  // Diferença em dias + 1 (porque o dia inicial conta)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY)
  return Math.max(1, diffDays + 1)
}

/**
 * Calcula end_date baseado em start_date e duration
 */
export function calculateEndDateFromDuration(
  startDate: string | Date,
  duration: number
): string {
  const start = typeof startDate === 'string' ? parseLocalDate(startDate) : startDate

  if (!start) {
    throw new Error('Start date is required')
  }

  const end = new Date(start)
  end.setDate(end.getDate() + Math.ceil(duration) - 1)

  return end.toISOString().split('T')[0]
}

/**
 * Calcula start_date baseado em end_date e duration
 */
export function calculateStartDateFromDuration(
  endDate: string | Date,
  duration: number
): string {
  const end = typeof endDate === 'string' ? parseLocalDate(endDate) : endDate

  if (!end) {
    throw new Error('End date is required')
  }

  const start = new Date(end)
  start.setDate(start.getDate() - Math.ceil(duration) + 1)

  return start.toISOString().split('T')[0]
}

/**
 * Tipos de ajuste quando a duração é alterada
 */
export type DurationAdjustmentType = 'extend_end' | 'pull_start' | 'add_lag'

/**
 * Aplica ajuste de duração baseado no tipo escolhido pelo usuário
 */
export function applyDurationAdjustment(
  newDuration: number,
  adjustmentType: DurationAdjustmentType,
  currentTask: {
    start_date: string
    end_date: string
    duration: number
    lag_days?: number
  }
): {
  start_date?: string
  end_date?: string
  duration: number
  lag_days?: number
} {
  const updates: any = { duration: newDuration }
  const durationDiff = newDuration - currentTask.duration

  switch (adjustmentType) {
    case 'extend_end':
      // Manter start_date, ajustar end_date
      updates.start_date = currentTask.start_date
      updates.end_date = calculateEndDateFromDuration(currentTask.start_date, newDuration)
      updates.lag_days = 0 // Clear lag when dates change
      break

    case 'pull_start':
      // Manter end_date, ajustar start_date
      updates.end_date = currentTask.end_date
      updates.start_date = calculateStartDateFromDuration(currentTask.end_date, newDuration)
      updates.lag_days = 0 // Clear lag when dates change
      break

    case 'add_lag':
      // Manter ambas as datas, adicionar diferença como lag
      updates.start_date = currentTask.start_date
      updates.end_date = currentTask.end_date
      updates.lag_days = (currentTask.lag_days || 0) + durationDiff
      break
  }

  return updates
}

/**
 * Sincroniza campos de tarefa quando uma data ou duração muda
 * Retorna objeto com campos atualizados para salvar no banco
 *
 * NOTA: Para mudanças de duração, esta função usa o comportamento padrão (extend_end).
 * Para dar escolha ao usuário, use applyDurationAdjustment() com o modal
 */
export function syncTaskFields(
  changedField: 'start_date' | 'end_date' | 'duration',
  newValue: string | number,
  currentTask: {
    start_date?: string | null
    end_date?: string | null
    duration?: number
    lag_days?: number
  }
): {
  start_date?: string
  end_date?: string
  duration?: number
  lag_days?: number
} {
  const updates: any = {}

  switch (changedField) {
    case 'start_date':
      // Mudou start_date - recalcular end_date ou duration
      updates.start_date = newValue as string

      if (currentTask.end_date) {
        // Tem end_date - recalcular duration
        updates.duration = calculateDurationFromDates(
          newValue as string,
          currentTask.end_date
        )
        // Clear lag when dates change
        updates.lag_days = 0
      } else if (currentTask.duration) {
        // Tem duration - recalcular end_date
        updates.end_date = calculateEndDateFromDuration(
          newValue as string,
          currentTask.duration
        )
        // Clear lag when dates change
        updates.lag_days = 0
      }
      break

    case 'end_date':
      // Mudou end_date - recalcular start_date ou duration
      updates.end_date = newValue as string

      if (currentTask.start_date) {
        // Tem start_date - recalcular duration
        updates.duration = calculateDurationFromDates(
          currentTask.start_date,
          newValue as string
        )
        // Clear lag when dates change
        updates.lag_days = 0
      } else if (currentTask.duration) {
        // Tem duration - recalcular start_date
        updates.start_date = calculateStartDateFromDuration(
          newValue as string,
          currentTask.duration
        )
        // Clear lag when dates change
        updates.lag_days = 0
      }
      break

    case 'duration':
      // Mudou duration - comportamento padrão: extend_end
      // Para dar escolha ao usuário, não use esta função diretamente
      updates.duration = newValue as number

      if (currentTask.start_date) {
        // Tem start_date - recalcular end_date
        updates.end_date = calculateEndDateFromDuration(
          currentTask.start_date,
          newValue as number
        )
        // Clear lag when dates change
        updates.lag_days = 0
      } else if (currentTask.end_date) {
        // Tem end_date - recalcular start_date
        updates.start_date = calculateStartDateFromDuration(
          currentTask.end_date,
          newValue as number
        )
        // Clear lag when dates change
        updates.lag_days = 0
      }
      break
  }

  return updates
}

/**
 * Valida se a duração está consistente com as datas
 */
export function validateTaskDates(task: {
  start_date?: string | null
  end_date?: string | null
  duration?: number
}): {
  isValid: boolean
  message?: string
} {
  if (!task.start_date || !task.end_date || !task.duration) {
    return { isValid: true } // Campos opcionais
  }

  const calculatedDuration = calculateDurationFromDates(
    task.start_date,
    task.end_date
  )

  const expectedDuration = Math.ceil(task.duration)

  if (calculatedDuration !== expectedDuration) {
    return {
      isValid: false,
      message: `Duração inconsistente: datas indicam ${calculatedDuration} dias, mas campo duration tem ${expectedDuration} dias`
    }
  }

  return { isValid: true }
}
