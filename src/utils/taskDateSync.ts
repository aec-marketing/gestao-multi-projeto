/**
 * Utilitários para sincronizar datas e duração de tarefas
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Parse seguro de data string para evitar problemas de timezone
 *
 * Esta função garante que:
 * 1. A data é interpretada no timezone local (não UTC)
 * 2. Não há conversão automática de timezone
 * 3. A data representa exatamente o dia especificado
 *
 * Formato esperado: YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS
 *
 * @param dateStr String no formato ISO (YYYY-MM-DD)
 * @returns Date object no timezone local ou null se inválido
 */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null

  // Remover parte de hora se existir
  const datePart = dateStr.split('T')[0]
  const parts = datePart.split('-')

  if (parts.length !== 3) return null

  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1 // Mês é 0-indexed
  const day = parseInt(parts[2], 10)

  // Validar valores
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  if (month < 0 || month > 11) return null
  if (day < 1 || day > 31) return null

  // Criar data no timezone local (não UTC)
  const date = new Date(year, month, day)

  // Normalizar para meia-noite
  date.setHours(0, 0, 0, 0)

  return date
}

/**
 * Formata Date object para string YYYY-MM-DD
 * Garante que a data é formatada no timezone local
 *
 * @param date Date object
 * @returns String no formato YYYY-MM-DD
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
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
 * Adiciona dias úteis a uma data (pulando fins de semana)
 *
 * @param start Data inicial
 * @param daysToAdd Número de dias úteis a adicionar
 * @returns Nova data após adicionar os dias úteis
 */
function addWorkingDays(start: Date, daysToAdd: number): Date {
  const result = new Date(start)
  let addedDays = 0

  // Se começar em fim de semana, avançar para segunda-feira
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1)
  }

  // Adicionar dias úteis
  while (addedDays < daysToAdd) {
    result.setDate(result.getDate() + 1)

    // Se não for fim de semana, conta como dia adicionado
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++
    }
  }

  return result
}

/**
 * Calcula end_date baseado em start_date e duration
 * 🔄 ONDA 5.4: Agora pula fins de semana automaticamente
 */
export function calculateEndDateFromDuration(
  startDate: string | Date,
  duration: number
): string {
  const start = typeof startDate === 'string' ? parseLocalDate(startDate) : startDate

  if (!start) {
    throw new Error('Start date is required')
  }

  // Se duração for 0 ou negativa, retornar start_date
  if (duration <= 0) {
    return formatLocalDate(start)
  }

  // Adicionar dias úteis (duration - 1 porque o dia inicial conta)
  const end = addWorkingDays(start, Math.ceil(duration) - 1)

  return formatLocalDate(end)
}

/**
 * Subtrai dias úteis de uma data (pulando fins de semana)
 *
 * @param end Data final
 * @param daysToSubtract Número de dias úteis a subtrair
 * @returns Nova data após subtrair os dias úteis
 */
function subtractWorkingDays(end: Date, daysToSubtract: number): Date {
  const result = new Date(end)
  let subtractedDays = 0

  // Se terminar em fim de semana, voltar para sexta-feira
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() - 1)
  }

  // Subtrair dias úteis
  while (subtractedDays < daysToSubtract) {
    result.setDate(result.getDate() - 1)

    // Se não for fim de semana, conta como dia subtraído
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      subtractedDays++
    }
  }

  return result
}

/**
 * Calcula start_date baseado em end_date e duration
 * 🔄 ONDA 5.4: Agora pula fins de semana automaticamente
 */
export function calculateStartDateFromDuration(
  endDate: string | Date,
  duration: number
): string {
  const end = typeof endDate === 'string' ? parseLocalDate(endDate) : endDate

  if (!end) {
    throw new Error('End date is required')
  }

  // Se duração for 0 ou negativa, retornar end_date
  if (duration <= 0) {
    return formatLocalDate(end)
  }

  // Subtrair dias úteis (duration - 1 porque o dia final conta)
  const start = subtractWorkingDays(end, Math.ceil(duration) - 1)

  return formatLocalDate(start)
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
