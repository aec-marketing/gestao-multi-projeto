/**
 * Testes para time.utils.ts
 * Sistema de Minutos (ONDA 1)
 */

import {
  daysToMinutes,
  minutesToDays,
  hoursToMinutes,
  minutesToHours,
  parseTimeInput,
  formatMinutes,
  validateDuration,
  validateTimeInput,
  MINUTES_PER_WORKING_DAY,
  MINUTES_PER_HOUR
} from '../time.utils'

describe('time.utils - Conversões Básicas', () => {
  describe('daysToMinutes', () => {
    it('deve converter 1 dia para 540 minutos', () => {
      expect(daysToMinutes(1)).toBe(540)
    })

    it('deve converter 1.5 dias para 810 minutos', () => {
      expect(daysToMinutes(1.5)).toBe(810)
    })

    it('deve converter 0.5 dias para 270 minutos', () => {
      expect(daysToMinutes(0.5)).toBe(270)
    })

    it('deve arredondar valores decimais', () => {
      expect(daysToMinutes(0.125)).toBe(68) // 67.5 → 68
    })
  })

  describe('minutesToDays', () => {
    it('deve converter 540 minutos para 1 dia', () => {
      expect(minutesToDays(540)).toBe(1)
    })

    it('deve converter 810 minutos para 1.5 dias', () => {
      expect(minutesToDays(810)).toBe(1.5)
    })

    it('deve converter 270 minutos para 0.5 dias', () => {
      expect(minutesToDays(270)).toBe(0.5)
    })
  })

  describe('hoursToMinutes', () => {
    it('deve converter 1 hora para 60 minutos', () => {
      expect(hoursToMinutes(1)).toBe(60)
    })

    it('deve converter 2.5 horas para 150 minutos', () => {
      expect(hoursToMinutes(2.5)).toBe(150)
    })

    it('deve arredondar valores decimais', () => {
      expect(hoursToMinutes(1.25)).toBe(75)
    })
  })

  describe('minutesToHours', () => {
    it('deve converter 60 minutos para 1 hora', () => {
      expect(minutesToHours(60)).toBe(1)
    })

    it('deve converter 150 minutos para 2.5 horas', () => {
      expect(minutesToHours(150)).toBe(2.5)
    })

    it('deve converter 90 minutos para 1.5 horas', () => {
      expect(minutesToHours(90)).toBe(1.5)
    })
  })
})

describe('time.utils - Parser de Entrada', () => {
  describe('parseTimeInput', () => {
    it('deve parsear "2h" para 120 minutos', () => {
      expect(parseTimeInput('2h')).toBe(120)
    })

    it('deve parsear "30m" para 30 minutos', () => {
      expect(parseTimeInput('30m')).toBe(30)
    })

    it('deve parsear "1.5d" para 810 minutos', () => {
      expect(parseTimeInput('1.5d')).toBe(810)
    })

    it('deve parsear "2d 3h" para 1260 minutos', () => {
      expect(parseTimeInput('2d 3h')).toBe(1260)
    })

    it('deve parsear "1d 30m" para 570 minutos', () => {
      expect(parseTimeInput('1d 30m')).toBe(570)
    })

    it('deve parsear apenas número como minutos', () => {
      expect(parseTimeInput('90')).toBe(90)
    })

    it('deve aceitar maiúsculas', () => {
      expect(parseTimeInput('2H')).toBe(120)
      expect(parseTimeInput('30M')).toBe(30)
      expect(parseTimeInput('1.5D')).toBe(810)
    })

    it('deve aceitar espaços extras', () => {
      expect(parseTimeInput('  2h  ')).toBe(120)
      expect(parseTimeInput('2d  3h')).toBe(1260)
    })

    it('deve retornar null para entrada inválida', () => {
      expect(parseTimeInput('abc')).toBeNull()
      expect(parseTimeInput('')).toBeNull()
      expect(parseTimeInput('2x')).toBeNull()
    })
  })
})

describe('time.utils - Formatação', () => {
  describe('formatMinutes (auto)', () => {
    it('deve formatar 540 minutos como "1 dia"', () => {
      expect(formatMinutes(540)).toBe('1 dia')
    })

    it('deve formatar 810 minutos como "1.5 dias"', () => {
      expect(formatMinutes(810)).toBe('1.5 dias')
    })

    it('deve formatar 1080 minutos como "2 dias"', () => {
      expect(formatMinutes(1080)).toBe('2 dias')
    })

    it('deve formatar 120 minutos como "2h"', () => {
      expect(formatMinutes(120)).toBe('2h')
    })

    it('deve formatar 150 minutos como "2.5h"', () => {
      expect(formatMinutes(150)).toBe('2.5h')
    })

    it('deve formatar 30 minutos como "30min"', () => {
      expect(formatMinutes(30)).toBe('30min')
    })

    it('deve formatar 0 minutos como "0 minutos"', () => {
      expect(formatMinutes(0)).toBe('0 minutos')
    })

    it('deve formatar valores negativos com sinal', () => {
      expect(formatMinutes(-120)).toBe('-2h')
      expect(formatMinutes(-30)).toBe('-30min')
    })
  })

  describe('formatMinutes (short)', () => {
    it('deve formatar em modo short', () => {
      expect(formatMinutes(810, 'short')).toBe('1.5d')
      expect(formatMinutes(120, 'short')).toBe('2.0h')
      expect(formatMinutes(30, 'short')).toBe('30m')
      expect(formatMinutes(0, 'short')).toBe('0m')
    })
  })

  describe('formatMinutes (long)', () => {
    it('deve formatar em modo long', () => {
      expect(formatMinutes(540, 'long')).toBe('1 dia')
      expect(formatMinutes(1080, 'long')).toBe('2 dias')
      expect(formatMinutes(810, 'long')).toBe('1 dia e 4 horas e 30 minutos')
      expect(formatMinutes(120, 'long')).toBe('2 horas')
      expect(formatMinutes(30, 'long')).toBe('30 minutos')
      expect(formatMinutes(0, 'long')).toBe('0 minutos')
    })
  })
})

describe('time.utils - Validações', () => {
  describe('validateDuration', () => {
    it('deve aceitar durações válidas para work', () => {
      expect(validateDuration(540, 'work')).toEqual({ valid: true })
      expect(validateDuration(120, 'work')).toEqual({ valid: true })
      expect(validateDuration(30, 'work')).toEqual({ valid: true })
    })

    it('deve rejeitar duração zero para work', () => {
      const result = validateDuration(0, 'work')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('maior que zero')
    })

    it('deve rejeitar duração negativa para work', () => {
      const result = validateDuration(-10, 'work')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('maior que zero')
    })

    it('deve aceitar duração zero para milestone', () => {
      expect(validateDuration(0, 'milestone')).toEqual({ valid: true })
    })

    it('deve rejeitar duração não-zero para milestone', () => {
      const result = validateDuration(30, 'milestone')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('duração zero')
    })

    it('deve rejeitar durações muito grandes', () => {
      const result = validateDuration(100000, 'work')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('máxima')
    })
  })

  describe('validateTimeInput', () => {
    it('deve validar e retornar minutos para entrada válida', () => {
      const result = validateTimeInput('2h')
      expect(result.valid).toBe(true)
      expect(result.minutes).toBe(120)
    })

    it('deve rejeitar entrada inválida', () => {
      const result = validateTimeInput('abc')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('inválido')
    })

    it('deve rejeitar duração zero', () => {
      const result = validateTimeInput('0')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('maior que zero')
    })
  })
})

describe('time.utils - Casos Reais', () => {
  it('reunião de 30 minutos', () => {
    const input = '30m'
    const minutes = parseTimeInput(input)
    expect(minutes).toBe(30)
    expect(formatMinutes(minutes!)).toBe('30min')
  })

  it('tarefa de 2 horas', () => {
    const input = '2h'
    const minutes = parseTimeInput(input)
    expect(minutes).toBe(120)
    expect(formatMinutes(minutes!)).toBe('2h')
  })

  it('projeto de 1.5 dias', () => {
    const input = '1.5d'
    const minutes = parseTimeInput(input)
    expect(minutes).toBe(810)
    expect(formatMinutes(minutes!)).toBe('1.5 dias')
  })

  it('tarefa complexa de 2 dias e 3 horas', () => {
    const input = '2d 3h'
    const minutes = parseTimeInput(input)
    expect(minutes).toBe(1260) // 1080 + 180
    expect(minutesToDays(minutes!)).toBeCloseTo(2.33, 2)
  })
})

// Constantes
describe('time.utils - Constantes', () => {
  it('deve ter constantes corretas', () => {
    expect(MINUTES_PER_WORKING_DAY).toBe(540)
    expect(MINUTES_PER_HOUR).toBe(60)
  })
})
