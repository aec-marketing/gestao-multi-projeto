import {
  AllocationWithDetails,
  WorkloadAnalysis,
  WorkloadAlert,
  AlertThresholds,
  DEFAULT_THRESHOLDS
} from '@/types/allocation.types'

// Calcular análise de carga de trabalho para um recurso
export function calculateWorkloadAnalysis(
  resourceId: string,
  resourceName: string,
  role: string,
  allocations: AllocationWithDetails[],
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): WorkloadAnalysis {
  const resourceAllocations = allocations.filter(a => a.resource_id === resourceId)
  
  // Contadores básicos
  const totalTasks = resourceAllocations.length
  const highPriorityTasks = resourceAllocations.filter(a => a.priority === 'alta').length
  const mediumPriorityTasks = resourceAllocations.filter(a => a.priority === 'media').length
  const lowPriorityTasks = resourceAllocations.filter(a => a.priority === 'baixa').length
  
  // Calcular horas totais (soma das durações das tarefas)
  const totalHours = resourceAllocations.reduce((sum, allocation) => {
    return sum + (allocation.task.duration || 0)
  }, 0)
  
  // Calcular horas semanais (aproximação baseada em datas)
  const weeklyHours = calculateWeeklyHours(resourceAllocations)
  
  // Gerar alertas
  const alerts = generateAlerts(
    totalTasks,
    highPriorityTasks,
    totalHours,
    weeklyHours,
    thresholds
  )
  
  // Determinar status geral
  const status = determineWorkloadStatus(alerts, totalTasks, weeklyHours, thresholds)
  
  return {
    resourceId,
    resourceName,
    role,
    totalTasks,
    highPriorityTasks,
    mediumPriorityTasks,
    lowPriorityTasks,
    totalHours,
    weeklyHours,
    alerts,
    status
  }
}

// Calcular horas semanais estimadas
function calculateWeeklyHours(allocations: AllocationWithDetails[]): number {
  // Agrupar tarefas por semana e calcular sobreposição
  const tasksByWeek = new Map<string, number>()
  
  allocations.forEach(allocation => {
    if (allocation.start_date && allocation.end_date) {
      const startDate = new Date(allocation.start_date)
      const endDate = new Date(allocation.end_date)
      const durationInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const weeks = Math.max(1, Math.ceil(durationInDays / 7))
      
      // Distribuir horas da tarefa pelas semanas
      const hoursPerWeek = (allocation.task.duration || 0) / weeks
      
      for (let i = 0; i < weeks; i++) {
        const weekKey = getWeekKey(new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000))
        tasksByWeek.set(weekKey, (tasksByWeek.get(weekKey) || 0) + hoursPerWeek)
      }
    }
  })
  
  // Retornar a semana com maior carga
  return Math.max(...Array.from(tasksByWeek.values()), 0)
}

// Gerar chave da semana (ano-semana)
function getWeekKey(date: Date): string {
  const year = date.getFullYear()
  const week = getWeekNumber(date)
  return `${year}-W${week.toString().padStart(2, '0')}`
}

// Calcular número da semana no ano
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

// Gerar alertas baseados nos limites
function generateAlerts(
  totalTasks: number,
  highPriorityTasks: number,
  totalHours: number,
  weeklyHours: number,
  thresholds: AlertThresholds
): WorkloadAlert[] {
  const alerts: WorkloadAlert[] = []
  
  // Alerta: Muitas tarefas
  if (totalTasks > thresholds.maxTasks) {
    alerts.push({
      type: 'too_many_tasks',
      severity: totalTasks > thresholds.maxTasks * 1.5 ? 'high' : 'medium',
      message: `Muitas tarefas ativas (${totalTasks})`,
      details: `Recomendado: máximo ${thresholds.maxTasks} tarefas`
    })
  }
  
  // Alerta: Muitas tarefas de alta prioridade
  if (highPriorityTasks > thresholds.maxHighPriorityTasks) {
    alerts.push({
      type: 'too_many_high_priority',
      severity: 'high',
      message: `Muitas tarefas de alta prioridade (${highPriorityTasks})`,
      details: `Recomendado: máximo ${thresholds.maxHighPriorityTasks} tarefas críticas`
    })
  }
  
  // Alerta: Muitas horas semanais
  if (weeklyHours > thresholds.maxWeeklyHours) {
    alerts.push({
      type: 'too_many_hours',
      severity: 'high',
      message: `Sobrecarga de horas (${weeklyHours.toFixed(1)}h/semana)`,
      details: `Recomendado: máximo ${thresholds.maxWeeklyHours}h/semana`
    })
  } else if (weeklyHours > thresholds.warningWeeklyHours) {
    alerts.push({
      type: 'too_many_hours',
      severity: 'medium',
      message: `Próximo ao limite (${weeklyHours.toFixed(1)}h/semana)`,
      details: `Atenção: próximo ao limite de ${thresholds.maxWeeklyHours}h/semana`
    })
  }
  
  return alerts
}

// Determinar status geral da carga de trabalho
function determineWorkloadStatus(
  alerts: WorkloadAlert[],
  totalTasks: number,
  weeklyHours: number,
  thresholds: AlertThresholds
): 'ok' | 'warning' | 'overload' | 'critical' {
  const highSeverityAlerts = alerts.filter(a => a.severity === 'high')
  const mediumSeverityAlerts = alerts.filter(a => a.severity === 'medium')
  
  if (highSeverityAlerts.length > 1) return 'critical'
  if (highSeverityAlerts.length > 0) return 'overload'
  if (mediumSeverityAlerts.length > 0) return 'warning'
  
  return 'ok'
}

// Analisar conflitos entre tarefas (mesmo período)
export function detectScheduleConflicts(allocations: AllocationWithDetails[]): WorkloadAlert[] {
  const conflicts: WorkloadAlert[] = []
  
  // Agrupar por recurso
  const resourceAllocations = new Map<string, AllocationWithDetails[]>()
  
  allocations.forEach(allocation => {
    const key = allocation.resource_id
    if (!resourceAllocations.has(key)) {
      resourceAllocations.set(key, [])
    }
    resourceAllocations.get(key)!.push(allocation)
  })
  
  // Detectar sobreposições para cada recurso
  resourceAllocations.forEach((resourceTasks, resourceId) => {
    const overlappingTasks = findOverlappingTasks(resourceTasks)
    
    if (overlappingTasks.length > 0) {
      conflicts.push({
        type: 'schedule_conflict',
        severity: 'medium',
        message: `${overlappingTasks.length} conflitos de agenda`,
        details: `Tarefas com datas sobrepostas encontradas`
      })
    }
  })
  
  return conflicts
}

// Encontrar tarefas com datas sobrepostas
function findOverlappingTasks(tasks: AllocationWithDetails[]): AllocationWithDetails[] {
  const overlapping: AllocationWithDetails[] = []
  
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const task1 = tasks[i]
      const task2 = tasks[j]
      
      if (task1.start_date && task1.end_date && task2.start_date && task2.end_date) {
        const start1 = new Date(task1.start_date)
        const end1 = new Date(task1.end_date)
        const start2 = new Date(task2.start_date)
        const end2 = new Date(task2.end_date)
        
        // Verificar sobreposição
        if (start1 <= end2 && start2 <= end1) {
          if (!overlapping.includes(task1)) overlapping.push(task1)
          if (!overlapping.includes(task2)) overlapping.push(task2)
        }
      }
    }
  }
  
  return overlapping
}

// Gerar resumo de estatísticas da equipe
export function generateTeamSummary(analyses: WorkloadAnalysis[]) {
  const totalResources = analyses.length
  const overloadedResources = analyses.filter(a => a.status === 'overload' || a.status === 'critical').length
  const warningResources = analyses.filter(a => a.status === 'warning').length
  const totalTasks = analyses.reduce((sum, a) => sum + a.totalTasks, 0)
  const totalHours = analyses.reduce((sum, a) => sum + a.totalHours, 0)
  const averageTasksPerPerson = totalTasks / totalResources
  const averageHoursPerPerson = totalHours / totalResources
  
  return {
    totalResources,
    overloadedResources,
    warningResources,
    healthyResources: totalResources - overloadedResources - warningResources,
    totalTasks,
    totalHours,
    averageTasksPerPerson: Math.round(averageTasksPerPerson * 10) / 10,
    averageHoursPerPerson: Math.round(averageHoursPerPerson * 10) / 10,
    teamHealth: overloadedResources === 0 ? 'healthy' : overloadedResources < totalResources * 0.3 ? 'warning' : 'critical'
  }
}