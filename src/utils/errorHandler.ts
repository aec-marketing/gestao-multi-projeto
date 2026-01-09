/**
 * Error handling utilities for consistent error management
 */

import { log } from './logger'

export interface AppError {
  message: string
  code?: string
  details?: unknown
  timestamp: Date
}

/**
 * Formats an error into a user-friendly message
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }

  return 'Ocorreu um erro inesperado'
}

/**
 * Creates a standardized error object
 */
export function createAppError(
  error: unknown,
  context?: string
): AppError {
  const message = formatErrorMessage(error)

  return {
    message: context ? `${context}: ${message}` : message,
    code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    details: error,
    timestamp: new Date()
  }
}

/**
 * Handles Supabase errors specifically
 */
export function handleSupabaseError(error: unknown, operation: string): string {
  const appError = createAppError(error, operation)

  // Check for common Supabase errors
  if (appError.message.includes('duplicate key')) {
    return 'Este registro já existe no sistema'
  }

  if (appError.message.includes('foreign key')) {
    return 'Não é possível realizar esta operação devido a dependências existentes'
  }

  if (appError.message.includes('not found')) {
    return 'Registro não encontrado'
  }

  if (appError.message.includes('permission')) {
    return 'Você não tem permissão para realizar esta operação'
  }

  return appError.message
}

/**
 * Shows a user-friendly error alert
 */
export function showErrorAlert(error: unknown, context?: string): void {
  const message = context
    ? handleSupabaseError(error, context)
    : formatErrorMessage(error)

  alert(`❌ ${message}`)
}

/**
 * Shows a success alert
 */
export function showSuccessAlert(message: string): void {
  alert(`✅ ${message}`)
}

/**
 * Logs error using the centralized logger
 */
export function logError(error: unknown, context?: string): void {
  const message = formatErrorMessage(error)
  log.error(message, context, error)
}

/**
 * Wraps an async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  options: {
    showAlert?: boolean
    rethrow?: boolean
    onError?: (error: AppError) => void
  } = {}
): Promise<T | null> {
  const { showAlert = true, rethrow = false, onError } = options

  try {
    return await fn()
  } catch (error) {
    const appError = createAppError(error, context)

    logError(error, context)

    if (showAlert) {
      showErrorAlert(error, context)
    }

    if (onError) {
      onError(appError)
    }

    if (rethrow) {
      throw error
    }

    return null
  }
}

/**
 * Error types for different operations
 */
export const ErrorContext = {
  PROJECT_CREATE: 'Erro ao criar projeto',
  PROJECT_UPDATE: 'Erro ao atualizar projeto',
  PROJECT_DELETE: 'Erro ao excluir projeto',
  PROJECT_LOAD: 'Erro ao carregar projeto',

  TASK_CREATE: 'Erro ao criar tarefa',
  TASK_UPDATE: 'Erro ao atualizar tarefa',
  TASK_DELETE: 'Erro ao excluir tarefa',
  TASK_LOAD: 'Erro ao carregar tarefas',

  RESOURCE_CREATE: 'Erro ao criar recurso',
  RESOURCE_UPDATE: 'Erro ao atualizar recurso',
  RESOURCE_DELETE: 'Erro ao excluir recurso',
  RESOURCE_LOAD: 'Erro ao carregar recursos',

  ALLOCATION_CREATE: 'Erro ao criar alocação',
  ALLOCATION_UPDATE: 'Erro ao atualizar alocação',
  ALLOCATION_DELETE: 'Erro ao excluir alocação',
  ALLOCATION_LOAD: 'Erro ao carregar alocações',

  PREDECESSOR_CREATE: 'Erro ao criar predecessor',
  PREDECESSOR_UPDATE: 'Erro ao atualizar predecessor',
  PREDECESSOR_DELETE: 'Erro ao excluir predecessor',
  PREDECESSOR_LOAD: 'Erro ao carregar predecessores',

  IMPORT_MSPROJECT: 'Erro ao importar MS Project',
  EXPORT_DATA: 'Erro ao exportar dados',

  GENERIC: 'Erro ao processar operação'
} as const
