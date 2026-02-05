/**
 * =====================================================
 * ONDA 3: Utilitários de Alocação e Detecção de Hora Extra
 * =====================================================
 *
 * Filosofia: "Hora extra NUNCA é automática. Sempre decisão consciente do usuário."
 *
 * Este arquivo contém funções para:
 * 1. Detectar quando uma alocação excede a capacidade disponível
 * 2. Identificar fins de semana e feriados
 * 3. Calcular multiplicadores de hora extra (CLT)
 */

import { Resource } from '@/types/database.types'

/**
 * Resultado da detecção de overflow de capacidade
 */
export interface CapacityOverflowResult {
  hasOverflow: boolean
  minutesNeeded: number
  minutesAvailable: number
  minutesOverflow: number
  isWeekend: boolean
  isHoliday: boolean
  suggestedMultiplier: number
}

/**
 * Opções para resolução de overflow
 */
export interface OvertimeOption {
  type: 'push_date' | 'overtime_weekday' | 'overtime_weekend'
  label: string
  description: string
  multiplier: number
  newEndDate?: string
  overtimeMinutes?: number
  estimatedCost: number
}

/**
 * ONDA 3.5: Representação de um dia de alocação no plano multi-dia
 */
export interface AllocationDayPlan {
  date: string
  normalMinutes: number // Minutos dentro da capacidade (8h, 9h, etc)
  overtimeMinutes: number // Minutos de hora extra
  overtimeMultiplier: number // 1.0 (sem OT), 1.5 (dia útil), 2.0 (fim de semana)
  isWeekend: boolean
  isHoliday: boolean
  hasOverflow: boolean // Se este dia excede capacidade
  overflowMinutes: number // Minutos que não cabem (vão para próximo dia)
}

/**
 * ONDA 3.5: Plano completo de alocação multi-dia
 */
export interface MultiDayAllocationPlan {
  days: AllocationDayPlan[]
  totalMinutes: number
  totalNormalMinutes: number
  totalOvertimeMinutes: number
  estimatedCost: number
  requiresUserDecision: boolean // Se há dias com overflow que precisam de decisão
  requiresWeekendDecision: boolean // 🌊 ONDA 4.1: Se há fins de semana que precisam de decisão
  weekendsDetected: number // 🌊 ONDA 4.1: Quantidade de fins de semana detectados
}

/**
 * 🌊 ONDA 4.2: Interface para decisão de fim de semana
 */
export interface WeekendDecision {
  date: string
  useWeekend: boolean // true = trabalhar no fim de semana, false = pular
  minutesToWork: number // Minutos a trabalhar (se useWeekend = true)
}

/**
 * 🌊 ONDA 4.2: Informações de um fim de semana que precisa de decisão
 */
export interface WeekendDay {
  date: string
  dayOfWeek: string // "Sábado" ou "Domingo"
  remainingMinutes: number // Minutos restantes da tarefa neste ponto
}

/**
 * Detecta se uma alocação excede a capacidade disponível do recurso em um dia
 *
 * @param minutesToAllocate - Minutos que se deseja alocar neste dia
 * @param resource - Recurso sendo alocado
 * @param date - Data da alocação
 * @param existingAllocationsMinutes - Minutos já alocados para este recurso neste dia
 * @returns Resultado da detecção de overflow
 *
 * @example
 * const result = detectCapacityOverflow(600, gabriel, '2026-01-23', 240)
 * if (result.hasOverflow) {
 *   console.log(`Overflow de ${result.minutesOverflow} minutos`)
 * }
 */
export function detectCapacityOverflow(
  minutesToAllocate: number,
  resource: Resource,
  date: string,
  existingAllocationsMinutes: number = 0
): CapacityOverflowResult {
  console.log('[OVERFLOW-DEBUG] detectCapacityOverflow chamado:', {
    minutesToAllocate,
    resourceName: resource.name,
    date,
    existingAllocationsMinutes
  })

  // Capacidade diária do recurso (em minutos)
  const dailyCapacityMinutes = resource.daily_capacity_minutes || 540 // Padrão: 9h/dia

  console.log('[OVERFLOW-DEBUG] Capacidade diária:', dailyCapacityMinutes)

  // Total de minutos que serão alocados neste dia
  const totalMinutes = existingAllocationsMinutes + minutesToAllocate

  console.log('[OVERFLOW-DEBUG] Cálculo:', {
    existingAllocationsMinutes,
    minutesToAllocate,
    totalMinutes,
    dailyCapacityMinutes,
    excede: totalMinutes > dailyCapacityMinutes
  })

  // Verificar se excede
  const hasOverflow = totalMinutes > dailyCapacityMinutes
  const minutesOverflow = Math.max(0, totalMinutes - dailyCapacityMinutes)

  // Verificar se é fim de semana ou feriado
  const dateObj = new Date(date + 'T00:00:00')
  const weekend = isWeekend(dateObj)
  const holiday = isHoliday(dateObj)

  // Sugerir multiplicador apropriado
  const suggestedMultiplier = getOvertimeMultiplier(dateObj)

  const result = {
    hasOverflow,
    minutesNeeded: minutesToAllocate,
    minutesAvailable: Math.max(0, dailyCapacityMinutes - existingAllocationsMinutes),
    minutesOverflow,
    isWeekend: weekend,
    isHoliday: holiday,
    suggestedMultiplier
  }

  console.log('[OVERFLOW-DEBUG] Resultado:', result)

  return result
}

/**
 * Verifica se uma data é fim de semana (sábado ou domingo)
 *
 * @param date - Data a verificar
 * @returns true se for sábado ou domingo
 *
 * @example
 * isWeekend(new Date('2026-01-24')) // true (sábado)
 * isWeekend(new Date('2026-01-26')) // false (segunda)
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay()
  return dayOfWeek === 0 || dayOfWeek === 6 // 0 = domingo, 6 = sábado
}

/**
 * Verifica se uma data é feriado
 *
 * NOTA: Por enquanto retorna false. Futuramente pode consultar:
 * - Tabela de feriados no banco de dados
 * - API externa de feriados brasileiros
 * - Feriados configurados por empresa
 *
 * @param date - Data a verificar
 * @returns true se for feriado
 *
 * @example
 * isHoliday(new Date('2026-01-01')) // true (Ano Novo)
 * isHoliday(new Date('2026-01-23')) // false
 */
export function isHoliday(date: Date): boolean {
  // TODO: Implementar verificação real de feriados
  // Pode consultar tabela holidays no banco ou API externa

  // Feriados fixos brasileiros (temporário)
  const month = date.getMonth() + 1
  const day = date.getDate()

  const fixedHolidays = [
    { month: 1, day: 1 },   // Ano Novo
    { month: 4, day: 21 },  // Tiradentes
    { month: 5, day: 1 },   // Dia do Trabalho
    { month: 9, day: 7 },   // Independência
    { month: 10, day: 12 }, // Nossa Senhora Aparecida
    { month: 11, day: 2 },  // Finados
    { month: 11, day: 15 }, // Proclamação da República
    { month: 12, day: 25 }  // Natal
  ]

  return fixedHolidays.some(h => h.month === month && h.day === day)
}

/**
 * Retorna o multiplicador de hora extra apropriado conforme CLT
 *
 * Regras CLT (Brasil):
 * - Dias úteis: 1.5× (50% a mais)
 * - Fins de semana: 2.0× (100% a mais)
 * - Feriados: 2.0× (100% a mais)
 *
 * @param date - Data da hora extra
 * @returns Multiplicador apropriado (1.5 ou 2.0)
 *
 * @example
 * getOvertimeMultiplier(new Date('2026-01-23')) // 1.5 (sexta-feira)
 * getOvertimeMultiplier(new Date('2026-01-24')) // 2.0 (sábado)
 * getOvertimeMultiplier(new Date('2026-01-01')) // 2.0 (feriado)
 */
export function getOvertimeMultiplier(date: Date): number {
  if (isHoliday(date) || isWeekend(date)) {
    return 2.0 // Fim de semana ou feriado: 100% a mais
  }
  return 1.5 // Dia útil: 50% a mais
}

/**
 * Gera opções de resolução quando há overflow de capacidade
 *
 * @param overflow - Resultado da detecção de overflow
 * @param resource - Recurso sendo alocado
 * @param currentDate - Data atual da alocação
 * @param taskEndDate - Data de fim da tarefa
 * @returns Array com 3 opções para o usuário escolher
 *
 * @example
 * const options = generateOvertimeOptions(overflow, gabriel, '2026-01-23', '2026-01-30')
 * // Retorna: [opção push, opção overtime weekday, opção weekend]
 */
export function generateOvertimeOptions(
  overflow: CapacityOverflowResult,
  resource: Resource,
  currentDate: string,
  taskEndDate: string
): OvertimeOption[] {
  const hourlyRate = resource.hourly_rate || 0
  const regularCostPerMinute = hourlyRate / 60

  const options: OvertimeOption[] = []

  // LIMITE CLT: Máximo 2h (120min) de hora extra por dia útil
  const MAX_OVERTIME_WEEKDAY_MINUTES = 120

  // Verificar se o dia atual é útil ou fim de semana
  const currentDateObj = new Date(currentDate + 'T00:00:00')
  const isCurrentWeekend = isWeekend(currentDateObj)

  // OPÇÃO 1: Empurrar para o próximo dia útil
  const nextDay = new Date(currentDate + 'T00:00:00')
  nextDay.setDate(nextDay.getDate() + 1)

  // Pular fins de semana se necessário
  while (isWeekend(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1)
  }

  const newEndDate = nextDay.toISOString().split('T')[0]

  options.push({
    type: 'push_date',
    label: 'Empurrar para próximo dia',
    description: `Alocar ${(overflow.minutesOverflow / 60).toFixed(1)}h no dia ${formatDate(nextDay)} (sem custo extra)`,
    multiplier: 1.0,
    newEndDate,
    estimatedCost: overflow.minutesOverflow * regularCostPerMinute
  })

  // OPÇÃO 2: Usar hora extra em dia útil (1.5×) - COM LIMITE CLT
  if (!isCurrentWeekend) {
    // Aplicar limite de 2h em dias úteis
    const allowedOvertimeMinutes = Math.min(overflow.minutesOverflow, MAX_OVERTIME_WEEKDAY_MINUTES)
    const overtimeCostWeekday = allowedOvertimeMinutes * regularCostPerMinute * 1.5

    const exceedsLimit = overflow.minutesOverflow > MAX_OVERTIME_WEEKDAY_MINUTES
    const exceededMinutes = overflow.minutesOverflow - MAX_OVERTIME_WEEKDAY_MINUTES

    options.push({
      type: 'overtime_weekday',
      label: 'Hora extra (dia útil)',
      description: exceedsLimit
        ? `${(allowedOvertimeMinutes / 60).toFixed(1)}h extra (limite CLT) + ${(exceededMinutes / 60).toFixed(1)}h empurrado para próximo dia`
        : `${(allowedOvertimeMinutes / 60).toFixed(1)}h extra com multiplicador 1.5× (CLT)`,
      multiplier: 1.5,
      overtimeMinutes: allowedOvertimeMinutes,
      estimatedCost: overtimeCostWeekday
    })
  } else {
    // Se já é fim de semana, não oferece opção de hora extra em dia útil
    // (não faz sentido, pois já está no fim de semana)
  }

  // OPÇÃO 3: Trabalhar no fim de semana (2.0×)
  const overtimeCostWeekend = overflow.minutesOverflow * regularCostPerMinute * 2.0

  // Próximo sábado
  const nextSaturday = new Date(currentDate + 'T00:00:00')
  const daysUntilSaturday = (6 - nextSaturday.getDay() + 7) % 7
  nextSaturday.setDate(nextSaturday.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday))

  options.push({
    type: 'overtime_weekend',
    label: 'Trabalhar no fim de semana',
    description: `${(overflow.minutesOverflow / 60).toFixed(1)}h no sábado ${formatDate(nextSaturday)} com multiplicador 2.0× (CLT)`,
    multiplier: 2.0,
    overtimeMinutes: overflow.minutesOverflow,
    newEndDate: nextSaturday.toISOString().split('T')[0],
    estimatedCost: overtimeCostWeekend
  })

  return options
}

/**
 * Formata data para exibição (DD/MM/YYYY)
 */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Calcula o custo total de uma opção de hora extra
 *
 * @param regularMinutes - Minutos normais de trabalho
 * @param overtimeMinutes - Minutos de hora extra
 * @param hourlyRate - Valor/hora do recurso
 * @param overtimeMultiplier - Multiplicador de hora extra
 * @returns Custo total
 */
export function calculateOvertimeCost(
  regularMinutes: number,
  overtimeMinutes: number,
  hourlyRate: number,
  overtimeMultiplier: number
): number {
  const regularHours = regularMinutes / 60
  const overtimeHours = overtimeMinutes / 60

  const regularCost = regularHours * hourlyRate
  const overtimeCost = overtimeHours * hourlyRate * overtimeMultiplier

  return regularCost + overtimeCost
}

/**
 * ONDA 4.1: Calcula plano de alocação multi-dia RECURSIVO com detecção de fins de semana
 *
 * Esta função distribui minutos ao longo de múltiplos dias, detectando:
 * - Overflow em CADA dia (hora extra necessária)
 * - Fins de semana que cruzam a alocação (precisam de decisão)
 *
 * MUDANÇA ONDA 4.1: Agora NÃO pula fins de semana automaticamente.
 * Em vez disso, detecta e marca como dias que precisam de decisão do usuário.
 *
 * @param totalMinutes - Total de minutos a alocar
 * @param resource - Recurso sendo alocado
 * @param startDate - Data de início da alocação
 * @param existingAllocations - Alocações já existentes por data (para considerar capacidade ocupada)
 * @param useOvertimeByDefault - Se true, usa hora extra automaticamente (sem perguntar)
 * @returns Plano completo de alocação multi-dia
 *
 * @example
 * const plan = calculateMultiDayAllocationPlan(1140, gabriel, '2026-01-26', {})
 * // Retorna: [
 * //   { date: '2026-01-26', normalMinutes: 540, overtimeMinutes: 0, hasOverflow: true, overflowMinutes: 600 },
 * //   { date: '2026-01-27', normalMinutes: 540, overtimeMinutes: 0, hasOverflow: true, overflowMinutes: 60 },
 * //   { date: '2026-01-28', normalMinutes: 60, overtimeMinutes: 0, hasOverflow: false, overflowMinutes: 0 }
 * // ]
 */
export function calculateMultiDayAllocationPlan(
  totalMinutes: number,
  resource: Resource,
  startDate: string,
  existingAllocations: Record<string, number> = {},
  useOvertimeByDefault: boolean = false
): MultiDayAllocationPlan {
  console.log('[MULTI-DAY-DEBUG] 🌊 ONDA 4.1: Calculando plano multi-dia COM detecção de fins de semana:', {
    totalMinutes,
    resourceName: resource.name,
    startDate,
    existingAllocations
  })

  const dailyCapacity = resource.daily_capacity_minutes || 540 // Padrão: 9h/dia
  const hourlyRate = resource.hourly_rate || 0
  const costPerMinute = hourlyRate / 60

  const days: AllocationDayPlan[] = []
  let remainingMinutes = totalMinutes
  let currentDate = new Date(startDate + 'T00:00:00')
  let requiresUserDecision = false
  let requiresWeekendDecision = false // 🌊 ONDA 4.1
  let weekendsDetected = 0 // 🌊 ONDA 4.1

  // Limite CLT: 2h por dia em dias úteis
  const MAX_OVERTIME_WEEKDAY_MINUTES = 120

  while (remainingMinutes > 0) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const existingMinutes = existingAllocations[dateStr] || 0
    const availableCapacity = Math.max(0, dailyCapacity - existingMinutes)

    // Verificar se é fim de semana/feriado
    const weekend = isWeekend(currentDate)
    const holiday = isHoliday(currentDate)

    console.log('[MULTI-DAY-DEBUG] 📅 Dia:', dateStr, {
      remainingMinutes,
      availableCapacity,
      existingMinutes,
      isWeekend: weekend,
      isHoliday: holiday
    })

    // 🌊 ONDA 4.1: DETECTAR FIM DE SEMANA (não pular automaticamente!)
    if (weekend && remainingMinutes > 0) {
      weekendsDetected++
      requiresWeekendDecision = true
      console.log('[WEEKEND-DEBUG] 🏖️ FIM DE SEMANA DETECTADO:', {
        date: dateStr,
        remainingMinutes,
        weekendsDetected
      })
    }

    // Determinar quantos minutos alocar neste dia
    let normalMinutes = 0
    let overtimeMinutes = 0
    let overtimeMultiplier = 1.0
    let hasOverflow = false
    let overflowMinutes = 0

    // 🌊 ONDA 4.1: Se for fim de semana, NÃO alocar por padrão (usuário decide depois)
    if (weekend) {
      // Por padrão, pular fim de semana (usuário pode decidir trabalhar depois)
      console.log('[WEEKEND-DEBUG] ⏭️ Pulando fim de semana (decisão do usuário necessária)')
      // Não alocar nada neste dia, avançar para próximo dia
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    if (remainingMinutes <= availableCapacity) {
      // Cabe tudo no dia (sem overflow)
      normalMinutes = remainingMinutes
      remainingMinutes = 0
    } else {
      // Não cabe tudo - tem overflow
      hasOverflow = true
      normalMinutes = availableCapacity
      overflowMinutes = remainingMinutes - availableCapacity

      // Se usar hora extra por padrão, calcular automaticamente
      if (useOvertimeByDefault) {
        if (weekend || holiday) {
          // Fim de semana: sem limite, multiplicador 2.0
          overtimeMinutes = overflowMinutes
          overtimeMultiplier = 2.0
          remainingMinutes = 0
          hasOverflow = false
          overflowMinutes = 0
        } else {
          // Dia útil: limite de 2h, multiplicador 1.5
          overtimeMinutes = Math.min(overflowMinutes, MAX_OVERTIME_WEEKDAY_MINUTES)
          overtimeMultiplier = 1.5
          remainingMinutes = overflowMinutes - overtimeMinutes
          overflowMinutes = remainingMinutes
        }
      } else {
        // Não usar hora extra automaticamente - empurrar tudo para próximo dia
        remainingMinutes = overflowMinutes
        requiresUserDecision = true // Marcar que precisa de decisão do usuário
      }
    }

    days.push({
      date: dateStr,
      normalMinutes,
      overtimeMinutes,
      overtimeMultiplier,
      isWeekend: weekend,
      isHoliday: holiday,
      hasOverflow,
      overflowMinutes
    })

    console.log('[MULTI-DAY-DEBUG] ✅ Dia alocado:', {
      date: dateStr,
      normalMinutes,
      overtimeMinutes,
      overtimeMultiplier,
      hasOverflow,
      overflowMinutes,
      remainingMinutes
    })

    // 🌊 ONDA 4.1: Avançar para o próximo dia (SEM pular fins de semana)
    currentDate.setDate(currentDate.getDate() + 1)

    // Segurança: evitar loop infinito (máximo 60 dias para cobrir fins de semana)
    if (days.length > 60) {
      console.error('[MULTI-DAY-DEBUG] ❌ ERRO: Mais de 60 dias necessários!')
      break
    }
  }

  // Calcular totais e custo estimado
  const totalNormalMinutes = days.reduce((sum, d) => sum + d.normalMinutes, 0)
  const totalOvertimeMinutes = days.reduce((sum, d) => sum + d.overtimeMinutes, 0)

  const estimatedCost = days.reduce((sum, d) => {
    const normalCost = d.normalMinutes * costPerMinute
    const overtimeCost = d.overtimeMinutes * costPerMinute * d.overtimeMultiplier
    return sum + normalCost + overtimeCost
  }, 0)

  const plan: MultiDayAllocationPlan = {
    days,
    totalMinutes,
    totalNormalMinutes,
    totalOvertimeMinutes,
    estimatedCost,
    requiresUserDecision,
    requiresWeekendDecision, // 🌊 ONDA 4.1
    weekendsDetected // 🌊 ONDA 4.1
  }

  console.log('[MULTI-DAY-DEBUG] 🎉 Plano completo:', plan)

  // 🌊 ONDA 4.1: Log específico para fins de semana
  if (requiresWeekendDecision) {
    console.log('[WEEKEND-DEBUG] 🏖️ RESUMO DE FINS DE SEMANA:', {
      weekendsDetected,
      requiresWeekendDecision,
      message: `${weekendsDetected} fim(ns) de semana detectado(s) - decisão do usuário necessária`
    })
  }

  return plan
}
