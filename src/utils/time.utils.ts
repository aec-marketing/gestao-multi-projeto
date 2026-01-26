/**
 * Utilitários para conversão e manipulação de tempo
 * Sistema baseado em MINUTOS como unidade fundamental
 *
 * Jornada de trabalho: 9h/dia útil = 540 minutos
 */

// ============================================================================
// CONSTANTES
// ============================================================================

export const WORKING_HOURS_PER_DAY = 9
export const MINUTES_PER_WORKING_DAY = 540 // 9h × 60min
export const MINUTES_PER_HOUR = 60

// ============================================================================
// CONVERSÕES BÁSICAS
// ============================================================================

/**
 * Converte dias úteis para minutos
 * @param days - Número de dias úteis (pode ser decimal)
 * @returns Minutos (arredondado)
 * @example daysToMinutes(1.5) // 810
 */
export function daysToMinutes(days: number): number {
  return Math.round(days * MINUTES_PER_WORKING_DAY)
}

/**
 * Converte minutos para dias úteis
 * @param minutes - Número de minutos
 * @returns Dias (com casas decimais)
 * @example minutesToDays(810) // 1.5
 */
export function minutesToDays(minutes: number): number {
  return minutes / MINUTES_PER_WORKING_DAY
}

/**
 * Converte horas para minutos
 * @param hours - Número de horas (pode ser decimal)
 * @returns Minutos
 * @example hoursToMinutes(2.5) // 150
 */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * MINUTES_PER_HOUR)
}

/**
 * Converte minutos para horas
 * @param minutes - Número de minutos
 * @returns Horas (com casas decimais)
 * @example minutesToHours(150) // 2.5
 */
export function minutesToHours(minutes: number): number {
  return minutes / MINUTES_PER_HOUR
}

// ============================================================================
// PARSER DE ENTRADA (Input do usuário)
// ============================================================================

/**
 * Parser de tempo flexível. Aceita múltiplos formatos:
 * - "2h" ou "2H" → 120 minutos
 * - "30m" ou "30M" → 30 minutos
 * - "1.5d" ou "1.5D" → 810 minutos
 * - "2d 3h" → 1260 minutos (2 dias + 3h)
 * - "1d 30m" → 570 minutos
 * - "90" (apenas número) → 90 minutos
 *
 * @param input - String de entrada do usuário
 * @returns Minutos (número inteiro) ou null se inválido
 *
 * @example
 * parseTimeInput("2h")      // 120
 * parseTimeInput("1.5d")    // 810
 * parseTimeInput("2d 3h")   // 1260
 * parseTimeInput("invalid") // null
 */
export function parseTimeInput(input: string): number | null {
  if (!input || typeof input !== 'string') return null

  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null

  // Caso 1: Apenas número (assumir minutos)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const value = parseFloat(trimmed)
    return isNaN(value) ? null : Math.round(value)
  }

  let totalMinutes = 0

  // Regex para capturar partes: número + unidade (d, h, m)
  const pattern = /(\d+(?:\.\d+)?)\s*([dhm])/g
  let match
  let hasMatch = false

  while ((match = pattern.exec(trimmed)) !== null) {
    hasMatch = true
    const value = parseFloat(match[1])
    const unit = match[2]

    if (isNaN(value)) continue

    switch (unit) {
      case 'd':
        totalMinutes += daysToMinutes(value)
        break
      case 'h':
        totalMinutes += hoursToMinutes(value)
        break
      case 'm':
        totalMinutes += value
        break
    }
  }

  return hasMatch ? Math.round(totalMinutes) : null
}

// ============================================================================
// FORMATAÇÃO PARA DISPLAY
// ============================================================================

/**
 * Formata minutos para exibição legível em português
 *
 * @param minutes - Número de minutos
 * @param format - Formato de saída: 'auto', 'short', 'long'
 * @returns String formatada
 *
 * Exemplos (formato 'auto'):
 * - 810 → "1.5 dias"
 * - 540 → "1 dia"
 * - 120 → "2h"
 * - 30 → "30min"
 * - 1350 → "2.5 dias"
 *
 * Exemplos (formato 'short'):
 * - 810 → "1.5d"
 * - 120 → "2h"
 * - 30 → "30m"
 *
 * Exemplos (formato 'long'):
 * - 810 → "1 dia e 4 horas e 30 minutos"
 * - 120 → "2 horas"
 */
export function formatMinutes(
  minutes: number,
  format: 'auto' | 'short' | 'long' = 'auto'
): string {
  if (minutes === 0) return format === 'short' ? '0m' : '0 minutos'

  const absMinutes = Math.abs(minutes)
  const sign = minutes < 0 ? '-' : ''

  // Formato SHORT (compacto)
  if (format === 'short') {
    // >= 1 dia? Mostrar em dias com 1 casa decimal
    if (absMinutes >= MINUTES_PER_WORKING_DAY) {
      const days = minutesToDays(absMinutes)
      return `${sign}${days.toFixed(1)}d`
    }
    // >= 1 hora? Mostrar em horas
    if (absMinutes >= MINUTES_PER_HOUR) {
      const hours = minutesToHours(absMinutes)
      return `${sign}${hours.toFixed(1)}h`
    }
    // Minutos
    return `${sign}${absMinutes}m`
  }

  // Formato LONG (detalhado)
  if (format === 'long') {
    const days = Math.floor(absMinutes / MINUTES_PER_WORKING_DAY)
    const remainingAfterDays = absMinutes % MINUTES_PER_WORKING_DAY
    const hours = Math.floor(remainingAfterDays / MINUTES_PER_HOUR)
    const mins = remainingAfterDays % MINUTES_PER_HOUR

    const parts: string[] = []
    if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`)
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`)
    if (mins > 0) parts.push(`${mins} ${mins === 1 ? 'minuto' : 'minutos'}`)

    return sign + parts.join(' e ')
  }

  // Formato AUTO (padrão - legível e conciso)
  // >= 1 dia? Mostrar em dias
  if (absMinutes >= MINUTES_PER_WORKING_DAY) {
    const days = minutesToDays(absMinutes)
    // Se for número redondo, não mostrar decimais
    if (absMinutes % MINUTES_PER_WORKING_DAY === 0) {
      return `${sign}${Math.round(days)} ${Math.round(days) === 1 ? 'dia' : 'dias'}`
    }
    return `${sign}${days.toFixed(1)} dias`
  }

  // >= 1 hora? Mostrar em horas
  if (absMinutes >= MINUTES_PER_HOUR) {
    const hours = minutesToHours(absMinutes)
    if (absMinutes % MINUTES_PER_HOUR === 0) {
      return `${sign}${Math.round(hours)}h`
    }
    return `${sign}${hours.toFixed(1)}h`
  }

  // Menos de 1 hora: minutos
  return `${sign}${absMinutes}min`
}

// ============================================================================
// VALIDAÇÕES
// ============================================================================

/**
 * Valida se um valor de minutos é válido para uma tarefa
 * @param minutes - Número de minutos
 * @param workType - Tipo de trabalho ('work', 'wait', 'milestone')
 * @returns { valid: boolean, error?: string }
 */
export function validateDuration(
  minutes: number,
  workType: 'work' | 'wait' | 'milestone' = 'work'
): { valid: boolean; error?: string } {
  // Milestone deve ser zero
  if (workType === 'milestone') {
    if (minutes !== 0) {
      return {
        valid: false,
        error: 'Marcos (milestones) devem ter duração zero'
      }
    }
    return { valid: true }
  }

  // Work e Wait devem ser > 0
  if (minutes <= 0) {
    return {
      valid: false,
      error: 'Duração deve ser maior que zero'
    }
  }

  // Limite máximo razoável (100 dias = 54000 minutos)
  const MAX_MINUTES = 100 * MINUTES_PER_WORKING_DAY
  if (minutes > MAX_MINUTES) {
    return {
      valid: false,
      error: `Duração máxima: ${formatMinutes(MAX_MINUTES)}`
    }
  }

  return { valid: true }
}

/**
 * Valida entrada de tempo antes de parsear
 * @param input - String de entrada
 * @returns { valid: boolean, error?: string }
 */
export function validateTimeInput(input: string): {
  valid: boolean
  error?: string
  minutes?: number
} {
  const minutes = parseTimeInput(input)

  if (minutes === null) {
    return {
      valid: false,
      error: 'Formato inválido. Use: "2h", "30m", "1.5d" ou "2d 3h"'
    }
  }

  const validation = validateDuration(minutes)
  if (!validation.valid) {
    return { valid: false, error: validation.error }
  }

  return { valid: true, minutes }
}

// ============================================================================
// HELPERS PARA EXIBIÇÃO
// ============================================================================

/**
 * Retorna string amigável para input placeholder
 * @example getTimeInputPlaceholder() // "Ex: 2h, 30m, 1.5d"
 */
export function getTimeInputPlaceholder(): string {
  return 'Ex: 2h, 30m, 1.5d'
}

/**
 * Retorna dicas de uso para o usuário
 */
export function getTimeInputHint(): string {
  return 'Formatos aceitos: "2h" (horas), "30m" (minutos), "1.5d" (dias), "2d 3h" (combinado)'
}

// ============================================================================
// CÁLCULO DE DATAS BASEADO EM WORK_TYPE
// ============================================================================

/**
 * Calcula a data de término baseado em:
 * - Data de início
 * - Duração em minutos
 * - Tipo de trabalho (work/wait/milestone)
 *
 * @param startDate - Data de início
 * @param durationMinutes - Duração em minutos
 * @param workType - Tipo: 'work' (dias úteis), 'wait' (dias corridos), 'milestone' (zero)
 * @returns Data de término calculada
 *
 * @example
 * // Work: 810 min (1.5 dias úteis) iniciando na segunda = termina na terça
 * calculateEndDate(new Date('2025-01-06'), 810, 'work')
 *
 * // Wait: 1440 min (1 dia corrido) iniciando no sábado = termina no domingo
 * calculateEndDate(new Date('2025-01-11'), 1440, 'wait')
 *
 * // Milestone: sempre retorna a mesma data
 * calculateEndDate(new Date('2025-01-06'), 0, 'milestone')
 */
export function calculateEndDate(
  startDate: Date,
  durationMinutes: number,
  workType: 'work' | 'wait' | 'milestone' = 'work'
): Date {
  // Milestone: duração zero, retorna mesma data
  if (workType === 'milestone') {
    return new Date(startDate)
  }

  // Wait: dias CORRIDOS (24h/dia, inclui fins de semana)
  if (workType === 'wait') {
    const calendarDays = Math.ceil(durationMinutes / 1440) // 1440 = 24h em minutos
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + calendarDays - 1) // -1 porque o dia de início conta
    return endDate
  }

  // Work: dias ÚTEIS (9h/dia, pula fins de semana)
  // Calcular quantos dias úteis são necessários
  const workingDaysNeeded = Math.ceil(minutesToDays(durationMinutes))
  return addWorkingDays(startDate, workingDaysNeeded - 1) // -1 porque o dia de início conta
}

/**
 * Adiciona dias úteis a uma data (pula fins de semana)
 * @param date - Data inicial
 * @param days - Número de dias úteis a adicionar
 * @returns Nova data
 */
export function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date)
  let daysToAdd = days

  while (daysToAdd > 0) {
    result.setDate(result.getDate() + 1)
    const dayOfWeek = result.getDay()

    // Pular sábado (6) e domingo (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysToAdd--
    }
  }

  return result
}

// ============================================================================
// JORNADAS VARIÁVEIS (ONDA 2)
// ============================================================================

/**
 * Verifica se uma data é fim de semana
 * @param date - Data a verificar
 * @returns true se for sábado ou domingo
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * Calcula data final baseado em duração e capacidade do recurso
 *
 * Esta função prepara o sistema para jornadas variáveis por recurso.
 * Atualmente usa capacidade fixa, mas está preparada para receber
 * capacidade variável de recursos individuais.
 *
 * @param startDate - Data de início
 * @param durationMinutes - Minutos de trabalho necessários
 * @param taskType - Tipo de tarefa (work/wait/milestone)
 * @param resourceId - ID do recurso (preparado para calendário futuro)
 * @param resourceCapacityPerDay - Capacidade diária em minutos (padrão: 540 = 9h)
 *
 * @returns Data final calculada
 *
 * @example
 * // Recurso padrão 9h/dia com tarefa de 1 dia
 * calculateEndDateForResource(
 *   new Date('2024-01-01'),
 *   540,
 *   'work',
 *   'resource-123',
 *   540
 * ) // Retorna 2024-01-01 (mesmo dia)
 *
 * @example
 * // Recurso 6h/dia com tarefa de 540min (1.5 dias)
 * calculateEndDateForResource(
 *   new Date('2024-01-01'),
 *   540,
 *   'work',
 *   'resource-456',
 *   360  // 6h/dia
 * ) // Retorna 2024-01-02 (precisa de 2 dias: 360min + 180min)
 */
export function calculateEndDateForResource(
  startDate: Date,
  durationMinutes: number,
  taskType: 'work' | 'wait' | 'milestone',
  resourceId: string,
  resourceCapacityPerDay: number = MINUTES_PER_WORKING_DAY
): Date {
  // MILESTONE: Duração zero, retorna mesma data
  if (taskType === 'milestone') {
    return new Date(startDate)
  }

  // WAIT: Dias corridos (24h/dia, inclui fins de semana)
  if (taskType === 'wait') {
    const calendarDays = Math.ceil(durationMinutes / 1440) // 1440 = 24h
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + calendarDays - 1) // -1 porque o dia de início conta
    return endDate
  }

  // WORK: Dias úteis respeitando capacidade do recurso
  let remaining = durationMinutes
  let current = new Date(startDate)

  while (remaining > 0) {
    // Pular fins de semana
    if (isWeekend(current)) {
      current.setDate(current.getDate() + 1)
      continue
    }

    // 🔮 PREPARADO PARA O FUTURO (ONDA 3)
    // Quando tiver calendário por recurso, trocar por:
    // const available = getResourceAvailability(resourceId, current)
    // Isso permitirá:
    // - Feriados específicos do recurso
    // - Férias/ausências
    // - Capacidade variável por dia da semana
    // - Alocações parciais (recurso compartilhado)
    const available = resourceCapacityPerDay

    // Alocar minutos do dia
    const allocated = Math.min(remaining, available)
    remaining -= allocated

    // Se ainda resta trabalho, avançar para próximo dia
    if (remaining > 0) {
      current.setDate(current.getDate() + 1)
    }
  }

  return current
}

// ============================================================================
// FUNÇÕES FUTURAS (ONDA 3) - Comentadas para referência
// ============================================================================

/**
 * 🔮 FUTURO: Obter disponibilidade real de um recurso em uma data
 *
 * Esta função será implementada na ONDA 3 quando tivermos:
 * - Calendário individual por recurso
 * - Controle de férias/ausências
 * - Feriados específicos
 * - Alocações parciais
 *
 * @param resourceId - ID do recurso
 * @param date - Data a verificar
 * @returns Minutos disponíveis naquela data
 *
 * function getResourceAvailability(resourceId: string, date: Date): number {
 *   // 1. Buscar capacidade base do recurso
 *   const resource = getResource(resourceId)
 *   const capacity = resource.daily_capacity_minutes || 540
 *
 *   // 2. Verificar se é feriado para este recurso
 *   if (isHolidayForResource(resourceId, date)) return 0
 *
 *   // 3. Verificar férias/ausências
 *   if (isResourceAbsent(resourceId, date)) return 0
 *
 *   // 4. Calcular quanto já está alocado
 *   const existing = getAllocationsForResourceOnDate(resourceId, date)
 *   const used = existing.reduce((sum, a) => sum + (a.allocated_minutes || 0), 0)
 *
 *   // 5. Retornar disponível
 *   return Math.max(0, capacity - used)
 * }
 */
