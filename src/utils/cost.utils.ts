/**
 * Utilitários para cálculo de custos de recursos
 *
 * REGRAS (conforme RULES.md):
 * - Custo = SOMA de todos os recursos alocados
 * - Custo Individual = (Minutos Alocados ÷ 60) × Custo/Hora
 *
 * ONDA 1: Alocação sempre 100% da tarefa
 * ONDA 3: Permitir alocação parcial (allocated_minutes)
 */

import { Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'

// ============================================================================
// CONSTANTES
// ============================================================================

export const DEFAULT_HOURLY_RATE = 0.00

// ============================================================================
// CÁLCULO DE CUSTO INDIVIDUAL
// ============================================================================

/**
 * Calcula o custo de um recurso em uma tarefa
 *
 * @param durationMinutes - Duração da tarefa em minutos
 * @param hourlyRate - Valor/hora do recurso em R$
 * @param allocatedMinutes - Minutos específicos alocados (ONDA 3 - futuro)
 *                           NULL = 100% da tarefa (padrão ONDA 1)
 * @returns Custo em R$
 *
 * @example
 * // ONDA 1: Recurso trabalha 100% da tarefa
 * calculateResourceCost(540, 100, null)  // 540min = 9h → R$900
 *
 * @example
 * // ONDA 3 (futuro): Recurso trabalha apenas metade
 * calculateResourceCost(540, 100, 270)  // 270min = 4.5h → R$450
 */
export function calculateResourceCost(
  durationMinutes: number,
  hourlyRate: number,
  allocatedMinutes: number | null = null,  // 🔮 ONDA 3: Alocação parcial
  overtimeMinutes: number = 0,  // 🔮 ONDA 3: Hora extra
  overtimeMultiplier: number = 1.5  // 🔮 ONDA 3: Multiplicador de hora extra
): number {
  // 🔮 PREPARADO PARA ONDA 3: Alocação parcial
  // Se allocated_minutes é NULL, usa 100% da task (comportamento ONDA 1)
  // Se allocated_minutes tem valor, usa apenas os minutos específicos (ONDA 3)
  const effectiveMinutes = allocatedMinutes !== null && allocatedMinutes !== undefined
    ? allocatedMinutes
    : durationMinutes

  // Custo normal
  const regularHours = effectiveMinutes / 60
  const regularCost = regularHours * hourlyRate

  // Custo de hora extra (se houver)
  const overtimeHours = overtimeMinutes / 60
  const overtimeCost = overtimeHours * hourlyRate * overtimeMultiplier

  const totalCost = regularCost + overtimeCost

  return Math.round(totalCost * 100) / 100 // Arredondar para 2 casas decimais
}

// ============================================================================
// CÁLCULO DE CUSTO TOTAL
// ============================================================================

/**
 * Calcula o custo total de uma tarefa com múltiplos recursos
 *
 * REGRA: Custo Total = SOMA(custos individuais)
 *
 * @param durationMinutes - Duração da tarefa em minutos
 * @param resources - Lista de recursos alocados
 * @param allocations - Lista de alocações (para pegar allocated_minutes - ONDA 3)
 * @returns Custo total em R$
 *
 * @example
 * const resources = [
 *   { id: '1', hourly_rate: 150 },
 *   { id: '2', hourly_rate: 80 }
 * ]
 * calculateTotalCost(540, resources)  // 540min = 9h
 * // Recurso 1: 9h × R$150 = R$1.350
 * // Recurso 2: 9h × R$80 = R$720
 * // TOTAL: R$2.070
 */
export function calculateTotalCost(
  durationMinutes: number,
  resources: Pick<Resource, 'id' | 'hourly_rate'>[],
  allocations?: Allocation[]  // 🔮 ONDA 3: Para pegar allocated_minutes + overtime_minutes
): number {
  let totalCost = 0

  for (const resource of resources) {
    // ✅ ONDA 3.5: Buscar TODAS as alocações deste recurso (pode ter fragmentos!)
    const resourceAllocations = allocations?.filter(a => a.resource_id === resource.id) || []

    // Se não tem alocações, usar 100% da tarefa (comportamento ONDA 1)
    if (resourceAllocations.length === 0) {
      const resourceCost = calculateResourceCost(
        durationMinutes,
        resource.hourly_rate,
        null, // NULL = 100% da tarefa
        0,
        1.0
      )
      totalCost += resourceCost
    } else {
      // ONDA 3.5: SOMAR todas as alocações deste recurso (fragmentos)
      for (const allocation of resourceAllocations) {
        const allocatedMinutes = allocation.allocated_minutes ?? null
        const overtimeMinutes = allocation.overtime_minutes || 0
        const overtimeMultiplier = (allocation as any)?.overtime_multiplier || 1.5

        const fragmentCost = calculateResourceCost(
          durationMinutes,
          resource.hourly_rate,
          allocatedMinutes,
          overtimeMinutes,
          overtimeMultiplier
        )

        totalCost += fragmentCost
      }
    }
  }

  return Math.round(totalCost * 100) / 100
}

// ============================================================================
// COMPARAÇÃO: CUSTO REAL × ESTIMADO
// ============================================================================

export interface CostComparison {
  estimated: number       // Custo estimado inicial
  actual: number          // Custo real com recursos alocados
  difference: number      // Diferença (actual - estimated)
  percentageDiff: number  // Diferença em % ((actual - estimated) / estimated × 100)
  status: 'ok' | 'warning' | 'overbudget'  // Status baseado na diferença
}

/**
 * Compara custo estimado com custo real
 *
 * @param estimatedCost - Custo estimado inicial
 * @param actualCost - Custo real baseado em recursos alocados
 * @returns Objeto com comparação detalhada
 *
 * @example
 * compareCosts(1000, 1200)
 * // {
 * //   estimated: 1000,
 * //   actual: 1200,
 * //   difference: 200,
 * //   percentageDiff: 20,
 * //   status: 'warning'
 * // }
 */
export function compareCosts(
  estimatedCost: number,
  actualCost: number
): CostComparison {
  const difference = actualCost - estimatedCost
  const percentageDiff = estimatedCost > 0
    ? (difference / estimatedCost) * 100
    : 0

  let status: 'ok' | 'warning' | 'overbudget' = 'ok'

  if (percentageDiff > 20) {
    status = 'overbudget'  // Mais de 20% acima
  } else if (percentageDiff > 10) {
    status = 'warning'  // Entre 10% e 20% acima
  }

  return {
    estimated: estimatedCost,
    actual: actualCost,
    difference: Math.round(difference * 100) / 100,
    percentageDiff: Math.round(percentageDiff * 100) / 100,
    status
  }
}

// ============================================================================
// FORMATAÇÃO DE MOEDA
// ============================================================================

/**
 * Formata valor em R$
 *
 * @param value - Valor numérico
 * @returns String formatada em BRL
 *
 * @example
 * formatCurrency(1234.56)  // "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

/**
 * Formata diferença de custo com sinal e cor
 *
 * @param difference - Diferença (pode ser positiva ou negativa)
 * @returns Objeto com texto formatado e classe CSS
 *
 * @example
 * formatCostDifference(200)
 * // { text: "+ R$ 200,00", colorClass: "text-red-600" }
 *
 * formatCostDifference(-150)
 * // { text: "- R$ 150,00", colorClass: "text-green-600" }
 */
export function formatCostDifference(difference: number): {
  text: string
  colorClass: string
} {
  const absValue = Math.abs(difference)
  const sign = difference > 0 ? '+' : difference < 0 ? '-' : ''
  const color = difference > 0
    ? 'text-red-600'   // Acima do orçamento = vermelho
    : difference < 0
    ? 'text-green-600' // Abaixo do orçamento = verde
    : 'text-gray-600'  // Igual = cinza

  return {
    text: `${sign} ${formatCurrency(absValue)}`,
    colorClass: color
  }
}

// ============================================================================
// PROJEÇÃO DE CUSTO (baseado em progresso)
// ============================================================================

/**
 * Projeta o custo final baseado no progresso atual
 *
 * Útil para estimar se vamos estourar o orçamento antes de concluir
 *
 * @param actualCostSoFar - Custo real gasto até agora
 * @param progressPercentage - Progresso da tarefa (0-100)
 * @returns Custo projetado ao final
 *
 * @example
 * // Gastou R$600 com 50% concluído
 * projectFinalCost(600, 50)  // R$1.200 projetado
 *
 * @example
 * // Gastou R$800 com 40% concluído
 * projectFinalCost(800, 40)  // R$2.000 projetado (alerta!)
 */
export function projectFinalCost(
  actualCostSoFar: number,
  progressPercentage: number
): number {
  if (progressPercentage === 0) return actualCostSoFar
  if (progressPercentage >= 100) return actualCostSoFar

  const projectedTotal = (actualCostSoFar / progressPercentage) * 100
  return Math.round(projectedTotal * 100) / 100
}

// ============================================================================
// EXEMPLO DE USO
// ============================================================================

/*
// EXEMPLO 1: Calcular custo de uma tarefa com 2 recursos

const task = {
  duration_minutes: 1080,  // 2 dias em 9h/dia
  estimated_cost: 2000
}

const resources = [
  { id: '1', hourly_rate: 150 },  // Senior
  { id: '2', hourly_rate: 80 }    // Junior
]

const actualCost = calculateTotalCost(task.duration_minutes, resources)
// Senior: 18h × R$150 = R$2.700
// Junior: 18h × R$80 = R$1.440
// TOTAL: R$4.140

const comparison = compareCosts(task.estimated_cost, actualCost)
// {
//   estimated: 2000,
//   actual: 4140,
//   difference: 2140,
//   percentageDiff: 107,
//   status: 'overbudget'
// }

console.log('Estimado:', formatCurrency(comparison.estimated))
console.log('Real:', formatCurrency(comparison.actual))
const diff = formatCostDifference(comparison.difference)
console.log('Diferença:', diff.text, diff.colorClass)

// EXEMPLO 2: Projeção de custo

const soFar = 1500  // Gastou R$1.500
const progress = 40  // Completou 40%

const projected = projectFinalCost(soFar, progress)
// R$3.750 projetado

if (projected > task.estimated_cost) {
  console.log('ALERTA: Custo projetado excede orçamento!')
}
*/
