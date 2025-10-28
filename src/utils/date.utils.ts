/**
 * Utilitários para manipulação de datas
 * Resolve problemas de fuso horário ao converter strings de data
 */

/**
 * Converte uma string de data (YYYY-MM-DD) para um objeto Date local
 * sem problemas de fuso horário
 *
 * @param dateString - Data no formato 'YYYY-MM-DD' ou ISO string
 * @returns Date object com hora zerada no fuso local
 */
export function parseLocalDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null

  // Se for uma string de data no formato YYYY-MM-DD
  if (dateString.includes('-') && !dateString.includes('T')) {
    const [year, month, day] = dateString.split('-').map(Number)
    // Mês em JavaScript é 0-indexed (0 = Janeiro, 11 = Dezembro)
    return new Date(year, month - 1, day, 0, 0, 0, 0)
  }

  // Para strings ISO completas
  const date = new Date(dateString)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

/**
 * Formata uma data para exibição no padrão brasileiro (dd/MM/yyyy)
 *
 * @param date - String de data, objeto Date ou null
 * @returns String formatada ou string vazia se data inválida
 */
export function formatDateBR(date: string | Date | null | undefined): string {
  if (!date) return ''

  let dateObj: Date

  if (typeof date === 'string') {
    const parsed = parseLocalDate(date)
    if (!parsed) return ''
    dateObj = parsed
  } else {
    dateObj = date
  }

  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  })
}

/**
 * Converte um Date object para string no formato YYYY-MM-DD
 * (para salvar no banco de dados)
 *
 * @param date - Date object
 * @returns String no formato YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Adiciona dias a uma data
 *
 * @param date - Data inicial
 * @param days - Número de dias para adicionar
 * @returns Nova data
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Calcula diferença em dias entre duas datas (inclusivo)
 *
 * @param startDate - Data inicial
 * @param endDate - Data final
 * @returns Número de dias (inclusivo)
 */
export function daysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  return diffDays + 1 // +1 para incluir o último dia
}
