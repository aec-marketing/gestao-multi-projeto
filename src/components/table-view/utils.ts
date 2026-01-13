/**
 * Utilitários para TableView
 */

/**
 * Formata tipo de tarefa para exibição amigável
 */
export function formatTaskType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Retorna classe de cor baseada no tipo de tarefa
 */
export function getTaskColorClass(type: string): string {
  const colors: Record<string, string> = {
    'projeto_mecanico': 'bg-blue-100 text-blue-800',
    'compras_mecanica': 'bg-purple-100 text-purple-800',
    'projeto_eletrico': 'bg-yellow-100 text-yellow-800',
    'compras_eletrica': 'bg-orange-100 text-orange-800',
    'fabricacao': 'bg-green-100 text-green-800',
    'tratamento_superficial': 'bg-pink-100 text-pink-800',
    'montagem_mecanica': 'bg-indigo-100 text-indigo-800',
    'montagem_eletrica': 'bg-red-100 text-red-800',
    'coleta': 'bg-teal-100 text-teal-800',
    'subtarefa': 'bg-gray-100 text-gray-800'
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

/**
 * Formata valor monetário para exibição
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00'
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

/**
 * Formata data para exibição (DD/MM/AAAA)
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '-'

  const d = new Date(date + 'T00:00:00') // Força timezone local
  return d.toLocaleDateString('pt-BR')
}
