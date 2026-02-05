'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { formatCurrency } from '@/utils/cost.utils'
import { formatMinutes } from '@/utils/time.utils'

/**
 * 🌊 ONDA 5: Interface para planejar alocações visualmente
 */

export interface PlannerDay {
  date: string
  dayOfWeek: string // "Seg", "Ter", etc
  isWeekend: boolean
  isSelected: boolean // Checkbox marcado
  workMode: 'none' | 'normal' | 'overtime' // Estado do checkbox (3 estados)
  allocatedMinutes: number
  overtimeMinutes: number
  overtimeMultiplier: number // 1.0 (normal), 1.5 (weekday OT), 2.0 (weekend OT)

  // Capacidade
  dailyCapacityMinutes: number
}

export interface AllocationFragment {
  start_date: string
  end_date: string
  allocated_minutes: number
  overtime_minutes: number
  overtime_multiplier: number
}

interface AllocationPlannerProps {
  taskName: string
  taskStartDate: string
  totalMinutes: number
  resourceName: string
  resourceId: string
  resourceHourlyRate: number
  resourceDailyCapacityMinutes: number
  onConfirm: (fragments: AllocationFragment[]) => void
  onCancel: () => void
  // Modo de edição
  editMode?: boolean
  existingFragments?: AllocationFragment[]
}

export function AllocationPlanner({
  taskName,
  taskStartDate,
  totalMinutes,
  resourceName,
  resourceHourlyRate,
  resourceDailyCapacityMinutes,
  onConfirm,
  onCancel,
  editMode = false,
  existingFragments = []
}: AllocationPlannerProps) {
  // Estado de configuração de hora extra
  const [overtimeEnabled, setOvertimeEnabled] = useState(false)
  const [maxOvertimeHours, setMaxOvertimeHours] = useState<1 | 2>(1)
  const [overtimeDropdownDayIndex, setOvertimeDropdownDayIndex] = useState<number | null>(null)

  // Calcular plano inicial (dias úteis necessários OU carregar fragmentos existentes)
  const initialDays = useMemo(() => {
    // 🔄 MODO DE EDIÇÃO: Carregar fragmentos existentes
    if (editMode && existingFragments.length > 0) {
      const days: PlannerDay[] = []

      // Encontrar range de datas (primeiro ao último fragmento)
      const firstDate = new Date(existingFragments[0].start_date + 'T00:00:00')
      const lastFragment = existingFragments[existingFragments.length - 1]
      const lastDate = new Date(lastFragment.end_date + 'T00:00:00')

      // Adicionar buffer de 7 dias antes e depois
      firstDate.setDate(firstDate.getDate() - 7)
      lastDate.setDate(lastDate.getDate() + 14)

      let currentDate = new Date(firstDate)

      while (currentDate <= lastDate) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const dayOfWeek = currentDate.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        const dayName = dayNames[dayOfWeek]

        // Verificar se existe fragmento para este dia
        const fragment = existingFragments.find(f => {
          const start = new Date(f.start_date + 'T00:00:00')
          const end = new Date(f.end_date + 'T00:00:00')
          return currentDate >= start && currentDate <= end
        })

        if (fragment) {
          // 🔧 ONDA 5.2 FIX: Distribuir minutos corretamente entre os dias do fragmento
          const fragmentStart = new Date(fragment.start_date + 'T00:00:00')
          const fragmentEnd = new Date(fragment.end_date + 'T00:00:00')

          // Calcular número de dias no fragmento
          const daysDiff = Math.floor((fragmentEnd.getTime() - fragmentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

          // Se fragmento tem múltiplos dias, distribuir minutos
          let dayAllocatedMinutes = fragment.allocated_minutes
          let dayOvertimeMinutes = fragment.overtime_minutes

          if (daysDiff > 1) {
            // Fragmento agrupado - precisa distribuir minutos entre os dias
            const totalMinutes = fragment.allocated_minutes + fragment.overtime_minutes
            const isLastDay = currentDate.getTime() === fragmentEnd.getTime()

            // Calcular índice deste dia dentro do fragmento (0-based)
            const dayIndexInFragment = Math.floor((currentDate.getTime() - fragmentStart.getTime()) / (1000 * 60 * 60 * 24))

            // Distribuir minutos: dias intermediários recebem capacidade diária, último dia recebe o resto
            if (!isLastDay) {
              // Dias intermediários: capacidade diária
              dayAllocatedMinutes = resourceDailyCapacityMinutes
              dayOvertimeMinutes = 0
            } else {
              // Último dia: resto dos minutos
              const minutesUsedInPreviousDays = dayIndexInFragment * resourceDailyCapacityMinutes
              const remainingMinutes = totalMinutes - minutesUsedInPreviousDays

              // Se tem overtime no fragmento, distribuir corretamente
              if (fragment.overtime_minutes > 0 || fragment.overtime_multiplier > 1.0) {
                // Tentar alocar primeiro os minutos normais
                if (remainingMinutes <= resourceDailyCapacityMinutes) {
                  dayAllocatedMinutes = remainingMinutes
                  dayOvertimeMinutes = 0
                } else {
                  dayAllocatedMinutes = resourceDailyCapacityMinutes
                  dayOvertimeMinutes = remainingMinutes - resourceDailyCapacityMinutes
                }
              } else {
                dayAllocatedMinutes = remainingMinutes
                dayOvertimeMinutes = 0
              }
            }
          }

          const hasOvertime = dayOvertimeMinutes > 0 || fragment.overtime_multiplier > 1.0

          days.push({
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            isSelected: true,
            workMode: hasOvertime ? 'overtime' : 'normal',
            allocatedMinutes: dayAllocatedMinutes,
            overtimeMinutes: dayOvertimeMinutes,
            overtimeMultiplier: fragment.overtime_multiplier,
            dailyCapacityMinutes: resourceDailyCapacityMinutes
          })
        } else {
          // Dia não alocado
          days.push({
            date: dateStr,
            dayOfWeek: dayName,
            isWeekend,
            isSelected: false,
            workMode: 'none',
            allocatedMinutes: 0,
            overtimeMinutes: 0,
            overtimeMultiplier: 1.0,
            dailyCapacityMinutes: resourceDailyCapacityMinutes
          })
        }

        currentDate.setDate(currentDate.getDate() + 1)
      }

      return days
    }

    // 🆕 MODO DE CRIAÇÃO: Calcular plano inicial (dias úteis necessários)
    const days: PlannerDay[] = []
    let currentDate = new Date(taskStartDate + 'T00:00:00')
    let remainingMinutes = totalMinutes
    const maxDays = 60

    for (let i = 0; i < maxDays && remainingMinutes > 0; i++) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const dayOfWeek = currentDate.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const dayName = dayNames[dayOfWeek]

      // Por padrão, selecionar apenas dias úteis
      const isSelected = !isWeekend && remainingMinutes > 0
      const allocatedMinutes = isSelected ? Math.min(remainingMinutes, resourceDailyCapacityMinutes) : 0

      days.push({
        date: dateStr,
        dayOfWeek: dayName,
        isWeekend,
        isSelected,
        workMode: isSelected ? 'normal' : 'none',
        allocatedMinutes,
        overtimeMinutes: 0,
        overtimeMultiplier: 1.0,
        dailyCapacityMinutes: resourceDailyCapacityMinutes
      })

      if (isSelected) {
        remainingMinutes -= allocatedMinutes
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return days
  }, [taskStartDate, totalMinutes, resourceDailyCapacityMinutes, editMode, existingFragments])

  const [days, setDays] = useState<PlannerDay[]>(initialDays)

  // Rastrear taskStartDate anterior para detectar mudanças
  const previousTaskStartDateRef = useRef<string>(taskStartDate)

  /**
   * 🔄 ONDA 5.4: Detectar mudanças na data de início e ajustar dias
   */
  useEffect(() => {
    if (editMode) return // Não aplicar em modo de edição

    const previousStartDate = previousTaskStartDateRef.current
    const newStartDate = taskStartDate

    // Se for a primeira renderização ou se a data não mudou, não fazer nada
    if (previousStartDate === newStartDate) {
      return
    }

    console.log('[PLANNER-DEBUG] Start date mudou:', {
      anterior: previousStartDate,
      nova: newStartDate
    })

    const prevDate = new Date(previousStartDate + 'T00:00:00')
    const newDate = new Date(newStartDate + 'T00:00:00')

    if (newDate < prevDate) {
      // 🔼 Data de início ANTERIOR - adicionar dias antes (não selecionados)
      const daysDiff = Math.floor((prevDate.getTime() - newDate.getTime()) / (1000 * 60 * 60 * 24))
      console.log('[PLANNER-DEBUG] Adicionando', daysDiff, 'dias antes do início')

      const newDays: PlannerDay[] = []

      // Adicionar dias entre nova data e data anterior
      let currentDate = new Date(newDate)
      while (currentDate < prevDate) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const dayOfWeek = currentDate.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        const dayName = dayNames[dayOfWeek]

        newDays.push({
          date: dateStr,
          dayOfWeek: dayName,
          isWeekend,
          isSelected: false,
          workMode: 'none',
          allocatedMinutes: 0,
          overtimeMinutes: 0,
          overtimeMultiplier: 1.0,
          dailyCapacityMinutes: resourceDailyCapacityMinutes
        })

        currentDate.setDate(currentDate.getDate() + 1)
      }

      // Manter todos os dias existentes
      newDays.push(...days)
      setDays(newDays)
    } else {
      // 🔽 Data de início POSTERIOR - remover dias antes da nova data
      console.log('[PLANNER-DEBUG] Removendo dias antes de', newStartDate)

      // Filtrar apenas dias >= nova data de início
      const filteredDays = days.filter(d => {
        const dayDate = new Date(d.date + 'T00:00:00')
        return dayDate >= newDate
      })

      setDays(filteredDays)
    }

    // Atualizar referência para próxima comparação
    previousTaskStartDateRef.current = newStartDate
  }, [taskStartDate]) // Apenas quando taskStartDate mudar

  /**
   * 🔄 ONDA 5.4: Detectar mudanças na duração da tarefa e ajustar dias automaticamente
   */
  useEffect(() => {
    // Calcular total atualmente alocado
    const currentAllocated = days.reduce((sum, day) => {
      if (day.workMode !== 'none') {
        return sum + day.allocatedMinutes + day.overtimeMinutes
      }
      return sum
    }, 0)

    const difference = totalMinutes - currentAllocated

    if (difference === 0) {
      // Já está correto, não fazer nada
      return
    }

    console.log('[PLANNER-DEBUG] Duração da tarefa mudou. Diferença:', difference, 'minutos')

    if (difference > 0) {
      // Precisa adicionar mais minutos
      // Estratégia: adicionar nos dias existentes ou criar novos dias
      const newDays = [...days]
      let remainingToAdd = difference

      // 1. Tentar adicionar no último dia alocado (se não estiver cheio)
      for (let i = newDays.length - 1; i >= 0 && remainingToAdd > 0; i--) {
        const day = newDays[i]

        if (day.workMode === 'normal' && day.allocatedMinutes < day.dailyCapacityMinutes) {
          const canAdd = day.dailyCapacityMinutes - day.allocatedMinutes
          const toAdd = Math.min(canAdd, remainingToAdd)

          newDays[i] = {
            ...day,
            allocatedMinutes: day.allocatedMinutes + toAdd
          }

          remainingToAdd -= toAdd
          console.log('[PLANNER-DEBUG] Adicionando', toAdd, 'min no dia', day.date)
          break
        }
      }

      // 2. Se ainda sobrou, adicionar novos dias úteis
      if (remainingToAdd > 0) {
        const lastAllocatedDayIndex = newDays.findLastIndex(d => d.workMode !== 'none')
        let currentDate = new Date(newDays[lastAllocatedDayIndex].date + 'T00:00:00')
        currentDate.setDate(currentDate.getDate() + 1)

        while (remainingToAdd > 0) {
          const dateStr = currentDate.toISOString().split('T')[0]
          const dayOfWeek = currentDate.getDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
          const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
          const dayName = dayNames[dayOfWeek]

          // Apenas adicionar dias úteis
          if (!isWeekend) {
            const toAllocate = Math.min(remainingToAdd, resourceDailyCapacityMinutes)

            newDays.push({
              date: dateStr,
              dayOfWeek: dayName,
              isWeekend,
              isSelected: true,
              workMode: 'normal',
              allocatedMinutes: toAllocate,
              overtimeMinutes: 0,
              overtimeMultiplier: 1.0,
              dailyCapacityMinutes: resourceDailyCapacityMinutes
            })

            remainingToAdd -= toAllocate
            console.log('[PLANNER-DEBUG] Criando novo dia', dateStr, 'com', toAllocate, 'min')
          }

          currentDate.setDate(currentDate.getDate() + 1)
        }
      }

      setDays(newDays)
    } else {
      // Precisa remover minutos (difference < 0)
      // Estratégia: remover dos últimos dias
      const newDays = recalculateDaysDistribution(days)
      setDays(newDays)
    }
  }, [totalMinutes]) // Apenas quando totalMinutes mudar

  /**
   * 🔄 Recalcular distribuição de minutos quando usuário faz mudanças
   * Garante que apenas os minutos necessários sejam alocados
   */
  function recalculateDaysDistribution(updatedDays: PlannerDay[]) {
    // Calcular total alocado
    let totalAllocated = 0
    for (const day of updatedDays) {
      if (day.workMode !== 'none') {
        totalAllocated += day.allocatedMinutes + day.overtimeMinutes
      }
    }

    // Se já alocou tudo que precisa, ajustar dias
    if (totalAllocated >= totalMinutes) {
      let accumulated = 0
      const newDays = [...updatedDays]

      for (let i = 0; i < newDays.length; i++) {
        const day = newDays[i]

        if (day.workMode === 'none') {
          continue // Dia não alocado, pular
        }

        const dayTotal = day.allocatedMinutes + day.overtimeMinutes

        if (accumulated + dayTotal <= totalMinutes) {
          // Dia inteiro cabe
          accumulated += dayTotal
        } else if (accumulated < totalMinutes) {
          // Último dia - precisa ajustar
          const remaining = totalMinutes - accumulated

          if (day.workMode === 'overtime') {
            // Dia tem overtime - distribuir remaining entre normal e overtime
            const normalCapacity = day.dailyCapacityMinutes

            if (remaining <= normalCapacity) {
              // Só precisa de normal, remover overtime
              newDays[i] = {
                ...day,
                workMode: 'normal',
                allocatedMinutes: remaining,
                overtimeMinutes: 0,
                overtimeMultiplier: 1.0
              }
            } else {
              // Precisa de normal + parte do overtime
              const neededOvertime = remaining - normalCapacity
              newDays[i] = {
                ...day,
                allocatedMinutes: normalCapacity,
                overtimeMinutes: neededOvertime
              }
            }
          } else {
            // Dia normal - ajustar allocated
            newDays[i] = {
              ...day,
              allocatedMinutes: remaining
            }
          }

          accumulated = totalMinutes
        } else {
          // Dia não é mais necessário - desmarcar
          newDays[i] = {
            ...day,
            isSelected: false,
            workMode: 'none',
            allocatedMinutes: 0,
            overtimeMinutes: 0,
            overtimeMultiplier: 1.0
          }
        }
      }

      return newDays
    }

    return updatedDays
  }

  /**
   * Agrupar dias consecutivos em fragmentos
   * 🌊 ONDA 5.3: Quebrar fragmentos quando há gaps (dias não alocados)
   */
  const fragments = useMemo(() => {
    const result: AllocationFragment[] = []
    let currentGroup: PlannerDay[] = []

    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const prevDay = days[i - 1]

      // 🔥 Se dia não está alocado (gap), finalizar grupo atual e pular
      if (day.workMode === 'none' || (day.allocatedMinutes === 0 && day.overtimeMinutes === 0)) {
        if (currentGroup.length > 0) {
          console.log('[PLANNER-DEBUG] Gap detectado em', day.date, '- finalizando grupo atual')
          result.push(createFragment(currentGroup))
          currentGroup = []
        }
        continue // Pular dia não alocado
      }

      // Verificar se deve iniciar novo grupo (apenas para dias alocados)
      const shouldBreak =
        currentGroup.length === 0 || // Primeiro dia
        !isConsecutive(prevDay.date, day.date) || // Não consecutivo
        prevDay.overtimeMultiplier !== day.overtimeMultiplier || // Mudou multiplicador
        prevDay.isWeekend !== day.isWeekend || // Mudou tipo de dia
        (prevDay.overtimeMinutes > 0) !== (day.overtimeMinutes > 0) // Mudou overtime on/off

      if (shouldBreak && currentGroup.length > 0) {
        // Salvar grupo anterior
        result.push(createFragment(currentGroup))
        currentGroup = []
      }

      // Adicionar dia ao grupo atual
      currentGroup.push(day)
    }

    // Último grupo
    if (currentGroup.length > 0) {
      result.push(createFragment(currentGroup))
    }

    console.log('[PLANNER-DEBUG] Fragmentos criados:', result.length, result)
    return result
  }, [days])

  /**
   * Verificar se duas datas são consecutivas
   */
  function isConsecutive(date1: string, date2: string): boolean {
    const d1 = new Date(date1 + 'T00:00:00')
    const d2 = new Date(date2 + 'T00:00:00')
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays === 1
  }

  /**
   * Criar fragmento a partir de grupo de dias
   */
  function createFragment(group: PlannerDay[]): AllocationFragment {
    const totalAllocated = group.reduce((sum, d) => sum + d.allocatedMinutes, 0)
    const totalOvertime = group.reduce((sum, d) => sum + d.overtimeMinutes, 0)
    const multiplier = group[0].overtimeMultiplier

    return {
      start_date: group[0].date,
      end_date: group[group.length - 1].date,
      allocated_minutes: totalAllocated,
      overtime_minutes: totalOvertime,
      overtime_multiplier: multiplier
    }
  }

  /**
   * Calcular custo total
   */
  const totalCost = useMemo(() => {
    const costPerMinute = resourceHourlyRate / 60
    let cost = 0

    for (const day of days) {
      if (day.isWeekend && day.workMode !== 'none') {
        // 🔥 FIM DE SEMANA: TODO tempo é overtime 2.0×
        const totalMinutes = day.allocatedMinutes + day.overtimeMinutes
        cost += totalMinutes * costPerMinute * 2.0
      } else {
        // Dia útil: normal + overtime
        const normalCost = day.allocatedMinutes * costPerMinute
        const overtimeCost = day.overtimeMinutes * costPerMinute * day.overtimeMultiplier
        cost += normalCost + overtimeCost
      }
    }

    return cost
  }, [days, resourceHourlyRate])

  /**
   * Calcular minutos totais alocados
   */
  const totalAllocatedMinutes = useMemo(() => {
    return days.reduce((sum, d) => sum + d.allocatedMinutes + d.overtimeMinutes, 0)
  }, [days])

  /**
   * Calcular prazo final
   */
  const finalDate = useMemo(() => {
    const lastDay = [...days].reverse().find(d => d.allocatedMinutes > 0 || d.overtimeMinutes > 0)
    return lastDay?.date || taskStartDate
  }, [days, taskStartDate])

  /**
   * Toggle checkbox (3 estados)
   */
  function handleDayClick(dayIndex: number) {
    const day = days[dayIndex]

    // 🔒 ONDA 5.2: Bloquear dias anteriores ao start_date da tarefa
    const taskStart = new Date(taskStartDate + 'T00:00:00')
    const dayDate = new Date(day.date + 'T00:00:00')

    if (dayDate < taskStart) {
      console.log('[PLANNER-DEBUG] Dia bloqueado - antes do início da tarefa:', day.date)
      return // Não permitir seleção
    }

    if (day.workMode === 'none') {
      // Estado 1: none → normal (ou overtime se fim de semana)
      const newDays = [...days]

      if (day.isWeekend) {
        // 🔥 FIM DE SEMANA: TODO tempo é overtime 2.0×
        newDays[dayIndex] = {
          ...day,
          isSelected: true,
          workMode: 'overtime',
          allocatedMinutes: 0, // Fim de semana não tem minutos "normais"
          overtimeMinutes: day.dailyCapacityMinutes,
          overtimeMultiplier: 2.0
        }
      } else {
        // Dia útil: normal
        newDays[dayIndex] = {
          ...day,
          isSelected: true,
          workMode: 'normal',
          allocatedMinutes: day.dailyCapacityMinutes,
          overtimeMinutes: 0,
          overtimeMultiplier: 1.0
        }
      }

      // Recalcular distribuição
      const recalculatedDays = recalculateDaysDistribution(newDays)
      setDays(recalculatedDays)
      setOvertimeDropdownDayIndex(null)
    } else if (day.workMode === 'normal' && overtimeEnabled) {
      // Estado 2: normal → mostrar dropdown para escolher hora extra
      setOvertimeDropdownDayIndex(dayIndex)
    } else if (day.workMode === 'normal' && !overtimeEnabled) {
      // Se overtime desabilitado: normal → none
      // 🔒 Não permitir desmarcar o dia inicial da tarefa
      const taskStart = new Date(taskStartDate + 'T00:00:00')
      const dayDate = new Date(day.date + 'T00:00:00')

      if (dayDate.getTime() === taskStart.getTime()) {
        console.log('[PLANNER-DEBUG] Não é possível desmarcar o dia inicial da tarefa')
        return
      }

      const newDays = [...days]
      newDays[dayIndex] = {
        ...day,
        isSelected: false,
        workMode: 'none',
        allocatedMinutes: 0,
        overtimeMinutes: 0,
        overtimeMultiplier: 1.0
      }
      // Recalcular distribuição
      const recalculatedDays = recalculateDaysDistribution(newDays)
      setDays(recalculatedDays)
    } else {
      // Estado 3: overtime → none
      // 🔒 Não permitir desmarcar o dia inicial da tarefa
      const taskStart = new Date(taskStartDate + 'T00:00:00')
      const dayDate = new Date(day.date + 'T00:00:00')

      if (dayDate.getTime() === taskStart.getTime()) {
        console.log('[PLANNER-DEBUG] Não é possível desmarcar o dia inicial da tarefa')
        return
      }

      const newDays = [...days]
      newDays[dayIndex] = {
        ...day,
        isSelected: false,
        workMode: 'none',
        allocatedMinutes: 0,
        overtimeMinutes: 0,
        overtimeMultiplier: 1.0
      }
      // Recalcular distribuição
      const recalculatedDays = recalculateDaysDistribution(newDays)
      setDays(recalculatedDays)
      setOvertimeDropdownDayIndex(null)
    }
  }

  /**
   * Ativar hora extra em um dia
   */
  function handleSetOvertime(dayIndex: number, hours: 1 | 2) {
    const day = days[dayIndex]
    const overtimeMinutes = hours * 60
    const multiplier = day.isWeekend ? 2.0 : 1.5

    const newDays = [...days]
    newDays[dayIndex] = {
      ...day,
      workMode: 'overtime',
      overtimeMinutes,
      overtimeMultiplier: multiplier
    }

    // Recalcular distribuição de minutos
    const recalculatedDays = recalculateDaysDistribution(newDays)
    setDays(recalculatedDays)
    setOvertimeDropdownDayIndex(null)
  }

  /**
   * Toggle de hora extra global
   */
  function toggleOvertimeEnabled() {
    const newEnabled = !overtimeEnabled
    setOvertimeEnabled(newEnabled)
    setOvertimeDropdownDayIndex(null)

    // Se desabilitar hora extra, remover overtime de todos os dias
    if (!newEnabled) {
      const newDays = days.map(day => {
        if (day.workMode === 'overtime') {
          return {
            ...day,
            workMode: 'normal' as const,
            overtimeMinutes: 0,
            overtimeMultiplier: 1.0
          }
        }
        return day
      })
      // Recalcular distribuição
      const recalculatedDays = recalculateDaysDistribution(newDays)
      setDays(recalculatedDays)
    }
  }

  /**
   * Confirmar alocação
   */
  function handleConfirm() {
    if (totalAllocatedMinutes < totalMinutes) {
      const missing = totalMinutes - totalAllocatedMinutes
      if (!confirm(`Faltam ${formatMinutes(missing)} para completar a tarefa. Deseja prosseguir mesmo assim?`)) {
        return
      }
    }

    onConfirm(fragments)
  }

  // Agrupar dias por semana para display
  const weeks = useMemo(() => {
    const result: PlannerDay[][] = []
    let currentWeek: PlannerDay[] = []

    for (const day of days) {
      currentWeek.push(day)

      // Se domingo ou último dia, finalizar semana
      if (day.dayOfWeek === 'Dom' || day === days[days.length - 1]) {
        result.push(currentWeek)
        currentWeek = []
      }
    }

    return result
  }, [days])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">
                🎯 Planejar Alocação
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {resourceName} • {taskName}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Duração necessária: {formatMinutes(totalMinutes)} • Capacidade diária: {formatMinutes(resourceDailyCapacityMinutes)}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 ml-4"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Overtime Toggle */}
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overtimeEnabled}
                onChange={toggleOvertimeEnabled}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">
                ⚡ Permitir Hora Extra
              </span>
            </label>

            {overtimeEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Máximo por dia:</span>
                <select
                  value={maxOvertimeHours}
                  onChange={(e) => setMaxOvertimeHours(Number(e.target.value) as 1 | 2)}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value={1}>1h</option>
                  <option value={2}>2h</option>
                </select>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs text-green-700 font-medium">Custo Total</div>
              <div className="text-lg font-bold text-green-900">{formatCurrency(totalCost)}</div>
              <div className="text-[10px] text-green-600">Taxa: R$ {resourceHourlyRate}/h</div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-700 font-medium">Prazo Final</div>
              <div className="text-lg font-bold text-blue-900">
                {new Date(finalDate + 'T00:00:00').toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short'
                })}
              </div>
              <div className="text-[10px] text-blue-600">{formatMinutes(totalAllocatedMinutes)} alocados</div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
              <div className="text-xs text-purple-700 font-medium">Fragmentos</div>
              <div className="text-lg font-bold text-purple-900">{fragments.length}</div>
              <div className="text-[10px] text-purple-600">
                {fragments.length === 1 ? 'período contínuo' : 'períodos separados'}
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-6">
          <div className="space-y-4">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-7 gap-2">
                  {week.map((day, dayIndex) => {
                    const absoluteIndex = days.indexOf(day)
                    const isWeekend = day.isWeekend

                    // 🔒 ONDA 5.2: Verificar se dia está bloqueado ou é o dia inicial
                    const taskStart = new Date(taskStartDate + 'T00:00:00')
                    const dayDate = new Date(day.date + 'T00:00:00')
                    const isBlocked = dayDate < taskStart
                    const isTaskStartDay = dayDate.getTime() === taskStart.getTime()

                    // Cores baseadas no estado
                    let borderColor = 'border-gray-300'
                    let bgColor = 'bg-white'
                    let textColor = 'text-gray-700'

                    if (isBlocked) {
                      // Dia bloqueado (antes do início da tarefa)
                      borderColor = 'border-gray-200'
                      bgColor = 'bg-gray-50'
                      textColor = 'text-gray-300'
                    } else if (isTaskStartDay) {
                      // Dia inicial da tarefa - VERDE com borda grossa
                      if (day.workMode === 'normal') {
                        borderColor = 'border-green-600'
                        bgColor = 'bg-green-50'
                        textColor = 'text-green-900'
                      } else if (day.workMode === 'overtime') {
                        borderColor = 'border-green-600'
                        bgColor = 'bg-green-50'
                        textColor = 'text-green-900'
                      } else {
                        borderColor = 'border-green-600'
                        bgColor = 'bg-green-50'
                        textColor = 'text-green-900'
                      }
                    } else if (day.workMode === 'normal') {
                      borderColor = 'border-blue-500'
                      bgColor = 'bg-blue-50'
                      textColor = 'text-blue-900'
                    } else if (day.workMode === 'overtime') {
                      if (isWeekend) {
                        // Fim de semana trabalhado: VERMELHO
                        borderColor = 'border-red-500'
                        bgColor = 'bg-red-50'
                        textColor = 'text-red-900'
                      } else {
                        // Dia útil com overtime: LARANJA
                        borderColor = 'border-orange-500'
                        bgColor = 'bg-orange-50'
                        textColor = 'text-orange-900'
                      }
                    } else if (isWeekend && day.workMode === 'none') {
                      bgColor = 'bg-gray-100'
                      textColor = 'text-gray-400'
                    }

                    return (
                      <div key={day.date} className="relative">
                        <button
                          onClick={() => handleDayClick(absoluteIndex)}
                          disabled={isBlocked}
                          className={`
                            w-full ${bgColor} ${borderColor} ${textColor}
                            ${isTaskStartDay ? 'border-4' : 'border-2'} rounded-lg p-3 text-center transition-all
                            ${isBlocked ? 'cursor-not-allowed opacity-40' : 'hover:shadow-md hover:scale-105'}
                            ${day.workMode === 'none' && !isBlocked ? 'opacity-60' : 'opacity-100'}
                            ${isTaskStartDay ? 'ring-2 ring-green-300' : ''}
                          `}
                          title={
                            isBlocked
                              ? 'Dia bloqueado - anterior ao início da tarefa'
                              : isTaskStartDay
                              ? '📌 Início da tarefa (não pode ser desmarcado)'
                              : ''
                          }
                        >
                          <div className="text-xs font-medium mb-1">
                            {day.dayOfWeek}
                            {isTaskStartDay && <span className="ml-1">📌</span>}
                          </div>
                          <div className="text-lg font-bold">
                            {new Date(day.date + 'T00:00:00').getDate()}
                          </div>
                          <div className="text-xs mt-1">
                            {isBlocked && (
                              <span className="text-gray-300">🔒</span>
                            )}
                            {!isBlocked && day.workMode === 'none' && (
                              <span className="text-gray-400">[ ]</span>
                            )}
                            {!isBlocked && day.workMode === 'normal' && (
                              <span className={isTaskStartDay ? "text-green-700 font-semibold" : "text-blue-700"}>
                                ✓ {formatMinutes(day.allocatedMinutes)}
                              </span>
                            )}
                            {!isBlocked && day.workMode === 'overtime' && (
                              <span className={day.isWeekend ? "text-red-700 font-bold" : isTaskStartDay ? "text-green-700 font-bold" : "text-orange-700"}>
                                ⚡ {formatMinutes(day.allocatedMinutes + day.overtimeMinutes)}
                                {day.isWeekend && <span className="text-[10px]"> 2.0×</span>}
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Dropdown de hora extra */}
                        {overtimeDropdownDayIndex === absoluteIndex && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-orange-500 rounded-lg shadow-xl z-10 p-2">
                            <div className="text-xs font-semibold text-gray-700 mb-2">Quantas horas extra?</div>
                            <button
                              onClick={() => handleSetOvertime(absoluteIndex, 1)}
                              className="w-full mb-1 px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 rounded border border-orange-300 transition-colors"
                            >
                              ⚡ 1h extra (1.5×)
                            </button>
                            <button
                              onClick={() => handleSetOvertime(absoluteIndex, 2)}
                              className="w-full px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 rounded border border-orange-300 transition-colors"
                            >
                              ⚡ 2h extra (1.5×)
                            </button>
                            <button
                              onClick={() => setOvertimeDropdownDayIndex(null)}
                              className="w-full mt-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legenda */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
                <span>Não alocado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 border-2 border-blue-500 bg-blue-50 rounded"></div>
                <span>✓ Normal</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 border-2 border-orange-500 bg-orange-50 rounded"></div>
                <span>⚡ Hora Extra (1.5×)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 border-2 border-red-500 bg-red-50 rounded"></div>
                <span>⚡ Fim de Semana (2.0×)</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 border-4 border-green-600 bg-green-50 rounded ring-2 ring-green-300"></div>
                <span className="text-green-700 font-semibold">📌 Início da Tarefa (fixo)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 border-2 border-gray-200 bg-gray-50 rounded opacity-40"></div>
                <span className="text-gray-400">🔒 Dia bloqueado</span>
              </div>
            </div>
          </div>

          {/* Aviso se faltar tempo */}
          {totalAllocatedMinutes < totalMinutes && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-900">
                ⚠️ <span className="font-semibold">Atenção:</span> Ainda faltam {formatMinutes(totalMinutes - totalAllocatedMinutes)} para completar a tarefa.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Confirmar Alocação
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
