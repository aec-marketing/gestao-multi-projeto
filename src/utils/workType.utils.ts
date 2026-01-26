/**
 * Utilitários para Work Type (Tipo de Tarefa)
 *
 * Mapeamento:
 * - work → Produção (dias úteis)
 * - wait → Dependência (dias corridos)
 * - milestone → Checkpoint (sem duração)
 */

export type WorkType = 'work' | 'wait' | 'milestone'

export interface WorkTypeOption {
  value: WorkType
  label: string
  description: string
  icon: string
  color: string
}

/**
 * Opções de Work Type para exibição
 */
export const WORK_TYPE_OPTIONS: WorkTypeOption[] = [
  {
    value: 'work',
    label: 'Produção',
    description: 'Trabalho em dias úteis (seg-sex)',
    icon: '🔧',
    color: '#3b82f6' // blue-500
  },
  {
    value: 'wait',
    label: 'Dependência',
    description: 'Espera em dias corridos (inclui fins de semana)',
    icon: '⏳',
    color: '#f59e0b' // amber-500
  },
  {
    value: 'milestone',
    label: 'Checkpoint',
    description: 'Marco ou entrega (sem duração)',
    icon: '🎯',
    color: '#10b981' // green-500
  }
]

/**
 * Obter label amigável de um work_type
 */
export function getWorkTypeLabel(workType: WorkType | null | undefined): string {
  if (!workType) return 'Produção'

  const option = WORK_TYPE_OPTIONS.find(opt => opt.value === workType)
  return option?.label || 'Produção'
}

/**
 * Obter ícone de um work_type
 */
export function getWorkTypeIcon(workType: WorkType | null | undefined): string {
  if (!workType) return '🔧'

  const option = WORK_TYPE_OPTIONS.find(opt => opt.value === workType)
  return option?.icon || '🔧'
}

/**
 * Obter cor de um work_type
 */
export function getWorkTypeColor(workType: WorkType | null | undefined): string {
  if (!workType) return '#3b82f6'

  const option = WORK_TYPE_OPTIONS.find(opt => opt.value === workType)
  return option?.color || '#3b82f6'
}

/**
 * Obter descrição de um work_type
 */
export function getWorkTypeDescription(workType: WorkType | null | undefined): string {
  if (!workType) return 'Trabalho em dias úteis'

  const option = WORK_TYPE_OPTIONS.find(opt => opt.value === workType)
  return option?.description || 'Trabalho em dias úteis'
}

/**
 * Validar se um work_type é válido
 */
export function isValidWorkType(workType: string): workType is WorkType {
  return ['work', 'wait', 'milestone'].includes(workType)
}

/**
 * Verificar se é um checkpoint (milestone)
 */
export function isCheckpoint(workType: WorkType | null | undefined): boolean {
  return workType === 'milestone'
}

/**
 * Verificar se é dependência (wait)
 */
export function isDependency(workType: WorkType | null | undefined): boolean {
  return workType === 'wait'
}

/**
 * Verificar se é produção (work)
 */
export function isProduction(workType: WorkType | null | undefined): boolean {
  return !workType || workType === 'work'
}
