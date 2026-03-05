// Tipos atualizados para o sistema de alocação sem porcentagem
import { Resource, Task, Project } from './database.types'

export interface CalendarEvent {
  id: string
  title: string
  startDate: Date
  endDate: Date
  priority: 'alta' | 'media' | 'baixa'
  resourceId: string
  resourceName: string
  projectId: string
  projectName: string
  projectCode: string
  clientName?: string | null
  taskId?: string
  taskType?: string
}

export interface Allocation {
  id: string
  resource_id: string
  task_id: string
  priority: 'alta' | 'media' | 'baixa'
  start_date?: string | null
  end_date?: string | null
  // 🆕 CAMPOS PREPARATÓRIOS (ONDA 3)
  allocated_minutes?: number | null  // Minutos específicos deste recurso (NULL = 100% da task)
  overtime_minutes?: number          // Minutos de hora extra (custo × 1.5 ou 2.0)
  overtime_multiplier?: number       // Multiplicador de hora extra (1.5 = dia útil, 2.0 = fim de semana/feriado)
  created_at?: string
  updated_at?: string
}

export interface AllocationWithDetails extends Allocation {
  resource: Resource
  task: TaskWithProject
}

export interface TaskWithProject extends Task {
  project: Project
}

// Interface para inserção de nova alocação
export interface AllocationInsert {
  resource_id: string
  task_id: string
  priority: 'alta' | 'media' | 'baixa'
  start_date?: string | null
  end_date?: string | null
}

// Análise de carga de trabalho
export interface WorkloadAnalysis {
  resourceId: string
  resourceName: string
  role: string
  totalTasks: number
  highPriorityTasks: number
  mediumPriorityTasks: number
  lowPriorityTasks: number
  totalHours: number
  weeklyHours: number
  alerts: WorkloadAlert[]
  status: 'ok' | 'warning' | 'overload' | 'critical'
}

export interface WorkloadAlert {
  type: 'too_many_tasks' | 'too_many_high_priority' | 'too_many_hours' | 'schedule_conflict'
  severity: 'low' | 'medium' | 'high'
  message: string
  details?: string
}

// Configurações do sistema de alertas
export interface AlertThresholds {
  maxTasks: number // Ex: 5
  maxHighPriorityTasks: number // Ex: 2
  maxWeeklyHours: number // Ex: 40
  warningWeeklyHours: number // Ex: 35
}

// Dedicação/Prioridade — controla se o recurso pode ser compartilhado entre tarefas sobrepostas
export const PRIORITY_CONFIG = {
  alta: {
    label: 'Exclusivo',
    color: 'bg-red-100 text-red-800',
    badgeColor: 'bg-red-500',
    description: 'Recurso dedicado — não pode ter outras tarefas sobrepostas',
    icon: '🔒',
    conflictBehavior: 'block' as const, // bloqueia sobreposição
  },
  media: {
    label: 'Compartilhado',
    color: 'bg-yellow-100 text-yellow-800',
    badgeColor: 'bg-yellow-500',
    description: 'Pode dividir tempo com outras tarefas (avisa sobre conflito)',
    icon: '⚡',
    conflictBehavior: 'warn' as const, // avisa, mas permite
  },
  baixa: {
    label: 'Flexível',
    color: 'bg-blue-100 text-blue-800',
    badgeColor: 'bg-blue-500',
    description: 'Alocação livre, sem restrições de sobreposição',
    icon: '🔓',
    conflictBehavior: 'allow' as const, // permite sem avisar
  }
} as const

// Status de carga com cores
export const WORKLOAD_STATUS = {
  ok: {
    label: 'Normal',
    color: 'bg-green-100 text-green-800',
    description: 'Carga de trabalho adequada'
  },
  warning: {
    label: 'Atenção',
    color: 'bg-yellow-100 text-yellow-800', 
    description: 'Próximo ao limite recomendado'
  },
  overload: {
    label: 'Sobrecarga',
    color: 'bg-orange-100 text-orange-800',
    description: 'Acima da capacidade recomendada'
  },
  critical: {
    label: 'Crítico',
    color: 'bg-red-100 text-red-800',
    description: 'Muito acima da capacidade'
  }
} as const

// Thresholds padrão
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  maxTasks: 5,
  maxHighPriorityTasks: 2, 
  maxWeeklyHours: 40,
  warningWeeklyHours: 35
}

export type { Resource }
