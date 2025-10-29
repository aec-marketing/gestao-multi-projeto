// Tipos para Sistema de Eventos Pessoais/Ausências
// Versão: 1.0
// Data: 28/10/2025

import { Resource } from './allocation.types'

/**
 * Tipos de eventos pessoais suportados
 */
export type EventType = 
  | 'medico'          // Consultas, exames médicos
  | 'ferias'          // Férias programadas
  | 'treinamento'     // Cursos, workshops
  | 'licenca'         // Licença médica, paternidade, etc
  | 'outro'           // Outros tipos de ausência

/**
 * Interface para evento pessoal no banco de dados
 */
export interface PersonalEvent {
  id: string
  resource_id: string
  title: string
  event_type: EventType
  start_date: string  // ISO date string (YYYY-MM-DD)
  end_date: string    // ISO date string (YYYY-MM-DD)
  is_all_day: boolean
  blocks_work: boolean
  notes?: string
  created_at: string
  updated_at: string
}

/**
 * Interface extendida com dados do recurso
 */
export interface PersonalEventWithResource extends PersonalEvent {
  resource: Resource
}

/**
 * DTO para criação de novo evento
 */
export interface CreatePersonalEventDTO {
  resource_id: string
  title: string
  event_type: EventType
  start_date: string
  end_date: string
  is_all_day?: boolean
  blocks_work?: boolean
  notes?: string
}

/**
 * DTO para atualização de evento existente
 */
export interface UpdatePersonalEventDTO {
  title?: string
  event_type?: EventType
  start_date?: string
  end_date?: string
  is_all_day?: boolean
  blocks_work?: boolean
  notes?: string
}

/**
 * Configuração visual dos tipos de eventos
 */
export const EVENT_TYPE_CONFIG: Record<EventType, {
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  medico: {
    label: 'Médico',
    icon: '🏥',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300'
  },
  ferias: {
    label: 'Férias',
    icon: '🏖️',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300'
  },
  treinamento: {
    label: 'Treinamento',
    icon: '📚',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300'
  },
  licenca: {
    label: 'Licença',
    icon: '📋',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300'
  },
  outro: {
    label: 'Outro',
    icon: '📌',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300'
  }
}

/**
 * Tipo para representar conflito entre evento e tarefa
 */
export interface EventConflict {
  event: PersonalEventWithResource
  task: {
    id: string
    name: string
    project_name: string
    start_date: string
    end_date: string
  }
  overlap_days: number
}

/**
 * Utilitário para verificar se um evento bloqueia trabalho em uma data específica
 */
export function doesEventBlockDate(event: PersonalEvent, date: Date): boolean {
  if (!event.blocks_work) return false
  
  const eventStart = new Date(event.start_date)
  const eventEnd = new Date(event.end_date)
  
  // Normalizar para comparação apenas de datas (sem horas)
  eventStart.setHours(0, 0, 0, 0)
  eventEnd.setHours(23, 59, 59, 999)
  date.setHours(12, 0, 0, 0)
  
  return date >= eventStart && date <= eventEnd
}

/**
 * Utilitário para calcular quantidade de dias de um evento
 */
export function getEventDuration(event: PersonalEvent): number {
  const start = new Date(event.start_date)
  const end = new Date(event.end_date)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1 // +1 porque inclui ambos os dias
}

/**
 * Utilitário para formatar período do evento
 */
export function formatEventPeriod(event: PersonalEvent): string {
  const start = new Date(event.start_date)
  const end = new Date(event.end_date)
  
  const startStr = start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const endStr = end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  
  if (event.start_date === event.end_date) {
    return startStr
  }
  
  return `${startStr} - ${endStr}`
}