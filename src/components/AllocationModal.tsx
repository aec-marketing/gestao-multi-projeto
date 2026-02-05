'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Resource, Task } from '@/types/database.types'
import { Allocation, PRIORITY_CONFIG } from '@/types/allocation.types'
import { formatDateBR } from '@/utils/date.utils'
import { formatMinutes } from '@/utils/time.utils'
import { calculateResourceCost, formatCurrency } from '@/utils/cost.utils'
import { showErrorAlert, showSuccessAlert, logError, ErrorContext } from '@/utils/errorHandler'
import { useActiveResources, useAllocations } from '@/hooks/useResources'
import { useResourceContext } from '@/contexts/ResourceContext'
import { checkResourceAvailability, ResourceConflict } from '@/lib/resource-service'
import { updateTaskActualCost } from '@/lib/task-cost-service'
import { detectCapacityOverflow, generateOvertimeOptions, CapacityOverflowResult, OvertimeOption, calculateMultiDayAllocationPlan, MultiDayAllocationPlan, WeekendDecision, WeekendDay } from '@/utils/allocation.utils'
import { OvertimeDecisionModal } from '@/components/project/OvertimeDecisionModal'
import { MultiDayAllocationModal, DayDecision } from '@/components/project/MultiDayAllocationModal'
import { WeekendDecisionModal } from '@/components/project/WeekendDecisionModal' // 🌊 ONDA 4.3
import { AllocationPlanner, AllocationFragment } from '@/components/project/AllocationPlanner' // 🌊 ONDA 5

interface AllocationModalProps {
  task: Task
  projectLeaderId: string | null
  allocationId?: string  // ONDA 3: ID da alocação para modo de edição (opcional)
  onClose: () => void
  onSuccess: () => void
}

export default function AllocationModal({
  task,
  projectLeaderId,
  allocationId,  // ONDA 3: ID da alocação para edição
  onClose,
  onSuccess
}: AllocationModalProps) {
  // ✅ Use global resources from context
  const { resources: allResources, isLoading: resourcesLoading } = useActiveResources()
  const { allocations: allAllocations } = useAllocations()
  const { refreshAllocations } = useResourceContext()

  const [selectedResourceId, setSelectedResourceId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<'lider' | 'operador'>('lider')
  const [priority, setPriority] = useState<'alta' | 'media' | 'baixa'>('media')
  const [isSaving, setIsSaving] = useState(false)
  const [conflicts, setConflicts] = useState<ResourceConflict[]>([])
  const [showConflictWarning, setShowConflictWarning] = useState(false)
  const [allowOverride, setAllowOverride] = useState(false)
  const [conflictingPriorities, setConflictingPriorities] = useState<string[]>([])

  // ONDA 3: Alocação parcial
  const [allocationType, setAllocationType] = useState<'full' | 'partial'>('full')
  const [allocatedMinutes, setAllocatedMinutes] = useState<number>(task.duration_minutes || 0)

  // ONDA 3: Hora extra
  const [hasOvertime, setHasOvertime] = useState(false)
  const [overtimeMinutes, setOvertimeMinutes] = useState<number>(0)
  const [overtimeMultiplier, setOvertimeMultiplier] = useState<number>(1.5) // Padrão: 50% a mais

  // ONDA 3: Estado do modal de decisão de hora extra
  const [showOvertimeDecisionModal, setShowOvertimeDecisionModal] = useState(false)
  const [overflowResult, setOverflowResult] = useState<CapacityOverflowResult | null>(null)
  const [overtimeOptions, setOvertimeOptions] = useState<OvertimeOption[]>([])
  const [selectedResourceForModal, setSelectedResourceForModal] = useState<Resource | null>(null)
  const [pendingAllocation, setPendingAllocation] = useState<{
    resourceId: string
    priority: 'alta' | 'media' | 'baixa'
    allocationType: 'full' | 'partial'
    allocatedMinutes: number
  } | null>(null)

  // ONDA 3.5: Estado do modal multi-dia recursivo
  const [showMultiDayModal, setShowMultiDayModal] = useState(false)
  const [multiDayPlan, setMultiDayPlan] = useState<MultiDayAllocationPlan | null>(null)

  // 🌊 ONDA 4.3: Estado do modal de fim de semana
  const [showWeekendModal, setShowWeekendModal] = useState(false)
  const [weekendDays, setWeekendDays] = useState<WeekendDay[]>([])
  const [weekendDecisions, setWeekendDecisions] = useState<WeekendDecision[]>([]) // Armazenar decisões de fim de semana

  // 🌊 ONDA 5: Estado do Planner
  const [showPlanner, setShowPlanner] = useState(false)
  const [existingFragmentsForEdit, setExistingFragmentsForEdit] = useState<AllocationFragment[]>([])

  // Filter allocations for this specific task
  const existingAllocations = allAllocations.filter(a => a.task_id === task.id)
  const isLoading = resourcesLoading

  // ONDA 3: Carregar dados da alocação existente quando em modo de edição
  useEffect(() => {
    if (allocationId) {
      const allocation = allAllocations.find(a => a.id === allocationId)
      if (allocation) {
        setSelectedResourceId(allocation.resource_id)
        setPriority(allocation.priority as 'alta' | 'media' | 'baixa')

        // Carregar alocação parcial
        if (allocation.allocated_minutes !== null && allocation.allocated_minutes !== undefined) {
          setAllocationType('partial')
          setAllocatedMinutes(allocation.allocated_minutes)
        } else {
          setAllocationType('full')
          setAllocatedMinutes(task.duration_minutes || 0)
        }

        // Carregar hora extra
        if (allocation.overtime_minutes && allocation.overtime_minutes > 0) {
          setHasOvertime(true)
          setOvertimeMinutes(allocation.overtime_minutes)
          setOvertimeMultiplier((allocation as any).overtime_multiplier || 1.5)
        } else {
          setHasOvertime(false)
          setOvertimeMinutes(0)
          setOvertimeMultiplier(1.5)
        }
      }
    }
  }, [allocationId, allAllocations, task.duration_minutes])

  /**
   * 🌊 ONDA 5.2: Abrir Planner em modo de edição
   */
  function openPlannerForEdit(resourceId: string) {
    console.log('[PLANNER-DEBUG] Abrindo Planner para edição - recurso:', resourceId)

    const selectedResource = allResources.find(r => r.id === resourceId)
    if (!selectedResource) {
      console.log('[PLANNER-DEBUG] Recurso não encontrado:', resourceId)
      return
    }

    // Buscar TODOS os fragmentos deste recurso nesta tarefa
    const resourceFragments = existingAllocations
      .filter(a => a.resource_id === resourceId)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .map(a => ({
        start_date: a.start_date,
        end_date: a.end_date,
        allocated_minutes: a.allocated_minutes ?? 0,
        overtime_minutes: a.overtime_minutes || 0,
        overtime_multiplier: (a as any).overtime_multiplier || 1.0
      }))

    console.log('[PLANNER-DEBUG] Fragmentos encontrados:', resourceFragments)

    setSelectedResourceForModal(selectedResource)
    setExistingFragmentsForEdit(resourceFragments)
    setPendingAllocation({
      resourceId: resourceId,
      priority: existingAllocations.find(a => a.resource_id === resourceId)?.priority as 'alta' | 'media' | 'baixa' || 'media',
      allocationType: 'full',
      allocatedMinutes: task.duration_minutes || 0
    })

    // Abrir Planner em modo de edição
    setShowPlanner(true)
  }

  // ONDA 3: Detecção automática de overflow quando recurso é selecionado
  useEffect(() => {
    const detectOverflow = async () => {
      console.log('[OVERFLOW-DEBUG] useEffect disparado', {
        allocationId,
        selectedResourceId,
        taskStartDate: task.start_date,
        taskName: task.name
      })

      // Só detectar para novas alocações (não em modo de edição)
      if (!selectedResourceId || !task.start_date) {
        console.log('[OVERFLOW-DEBUG] Saindo cedo:', {
          motivo: !selectedResourceId ? 'sem recurso' : 'sem data'
        })
        return
      }

      const selectedResource = allResources.find(r => r.id === selectedResourceId)
      if (!selectedResource) {
        console.log('[OVERFLOW-DEBUG] Recurso não encontrado:', selectedResourceId)
        return
      }

      console.log('[OVERFLOW-DEBUG] Recurso selecionado:', {
        nome: selectedResource.name,
        capacidadeDiaria: selectedResource.daily_capacity_minutes
      })

      // Minutos que queremos alocar
      const minutesToAllocate = allocationType === 'partial' ? allocatedMinutes : task.duration_minutes || 0

      console.log('[OVERFLOW-DEBUG] Minutos a alocar:', {
        allocationType,
        minutesToAllocate,
        taskDurationMinutes: task.duration_minutes,
        allocatedMinutes
      })

      // Buscar alocações existentes do recurso no mesmo dia (start_date)
      const existingAllocationsOnDate = allAllocations.filter(a =>
        a.resource_id === selectedResourceId &&
        a.start_date === task.start_date &&
        a.task_id !== task.id
      )

      console.log('[OVERFLOW-DEBUG] Alocações existentes no dia:', {
        quantidade: existingAllocationsOnDate.length,
        alocacoes: existingAllocationsOnDate.map(a => ({
          allocated_minutes: a.allocated_minutes,
          task_id: a.task_id
        }))
      })

      // Calcular total de minutos já alocados neste dia
      // IMPORTANTE: Se allocated_minutes é NULL, buscar duration_minutes da tarefa
      let existingMinutesOnDate = 0

      for (const alloc of existingAllocationsOnDate) {
        if (alloc.allocated_minutes !== null && alloc.allocated_minutes !== undefined) {
          // Tem valor explícito
          console.log('[OVERFLOW-DEBUG] Somando minutos (explícito):', { alloc_id: alloc.id, minutes: alloc.allocated_minutes })
          existingMinutesOnDate += alloc.allocated_minutes
        } else {
          // NULL = 100% da tarefa, buscar duration_minutes
          console.log('[OVERFLOW-DEBUG] allocated_minutes é NULL, buscando task...')
          const { data: taskData, error } = await supabase
            .from('tasks')
            .select('duration_minutes')
            .eq('id', alloc.task_id)
            .single()

          if (error) {
            console.error('[OVERFLOW-DEBUG] Erro ao buscar task:', error)
            continue
          }

          const minutes = taskData?.duration_minutes || 0
          console.log('[OVERFLOW-DEBUG] Somando minutos (100% da task):', {
            alloc_id: alloc.id,
            task_id: alloc.task_id,
            duration_minutes: minutes
          })
          existingMinutesOnDate += minutes
        }
      }

      console.log('[OVERFLOW-DEBUG] Total de minutos já alocados:', existingMinutesOnDate)

      // ONDA 3.5: Calcular plano multi-dia RECURSIVO
      // Criar mapa de alocações existentes por data
      const existingAllocationsByDate: Record<string, number> = {}
      const allResourceAllocations = allAllocations.filter(a => a.resource_id === selectedResourceId)

      for (const alloc of allResourceAllocations) {
        const dateKey = alloc.start_date
        if (!existingAllocationsByDate[dateKey]) {
          existingAllocationsByDate[dateKey] = 0
        }

        if (alloc.allocated_minutes !== null && alloc.allocated_minutes !== undefined) {
          existingAllocationsByDate[dateKey] += alloc.allocated_minutes
        } else {
          // NULL = 100% da tarefa
          const { data: taskData } = await supabase
            .from('tasks')
            .select('duration_minutes')
            .eq('id', alloc.task_id)
            .single()

          existingAllocationsByDate[dateKey] += taskData?.duration_minutes || 0
        }
      }

      console.log('[MULTI-DAY-DEBUG] Alocações existentes por data:', existingAllocationsByDate)

      // Calcular plano multi-dia
      const plan = calculateMultiDayAllocationPlan(
        minutesToAllocate,
        selectedResource,
        task.start_date,
        existingAllocationsByDate,
        false // Não usar hora extra automaticamente - perguntar ao usuário
      )

      console.log('[MULTI-DAY-DEBUG] Plano calculado:', plan)

      // 🌊 ONDA 5: Abrir Planner para TODOS os casos multi-dia
      // (Substitui os modais de Weekend e MultiDay)
      if (plan.days.length > 1 || plan.requiresWeekendDecision || plan.requiresUserDecision) {
        console.log('[PLANNER-DEBUG] 🎯 Abrindo Planner para planejamento visual')

        // Guardar informações da alocação pendente
        setPendingAllocation({
          resourceId: selectedResourceId,
          priority: priority,
          allocationType: allocationType,
          allocatedMinutes: allocatedMinutes
        })

        setSelectedResourceForModal(selectedResource)
        setMultiDayPlan(plan)
        setShowPlanner(true)

        console.log('[PLANNER-DEBUG] Planner aberto!')
        return
      }

      // 🌊 ONDA 5: Modais antigos DESATIVADOS (mantidos para possível reativação)
      /*
      // 🌊 ONDA 4.3: PRIORIDADE CRONOLÓGICA - Verificar fins de semana PRIMEIRO
      if (plan.requiresWeekendDecision && plan.weekendsDetected > 0) {
        console.log('[WEEKEND-DEBUG] 🏖️ Fins de semana detectados - abrindo modal de fim de semana PRIMEIRO')

        // Guardar informações da alocação pendente
        setPendingAllocation({
          resourceId: selectedResourceId,
          priority: priority,
          allocationType: allocationType,
          allocatedMinutes: allocatedMinutes
        })

        setSelectedResourceForModal(selectedResource)
        setMultiDayPlan(plan)

        // Extrair fins de semana do plano para o modal
        const weekends: WeekendDay[] = []
        let remainingMinutes = minutesToAllocate

        // Simular distribuição cronológica para saber quantos minutos restam em cada fim de semana
        const dailyCapacity = selectedResource.daily_capacity_minutes || 540
        const planDate = new Date(task.start_date + 'T00:00:00')

        while (remainingMinutes > 0) {
          const dateStr = planDate.toISOString().split('T')[0]
          const dayOfWeek = planDate.getDay() // 0 = domingo, 6 = sábado

          if (dayOfWeek === 0 || dayOfWeek === 6) {
            // É fim de semana
            weekends.push({
              date: dateStr,
              dayOfWeek: dayOfWeek === 6 ? 'Sábado' : 'Domingo',
              remainingMinutes
            })
          } else {
            // Dia útil - consumir capacidade
            remainingMinutes -= Math.min(remainingMinutes, dailyCapacity)
          }

          planDate.setDate(planDate.getDate() + 1)

          // Segurança
          if (weekends.length > 10) break
        }

        setWeekendDays(weekends)
        setShowWeekendModal(true)

        console.log('[WEEKEND-DEBUG] Estado do modal de fim de semana atualizado!', weekends)
        return // Parar aqui - modal de overflow só abre depois
      }

      // Se o plano requer decisão do usuário (tem dias com overflow), abrir modal multi-dia
      if (plan.requiresUserDecision) {
        console.log('[MULTI-DAY-DEBUG] ⚠️ OVERFLOW MULTI-DIA DETECTADO! Abrindo modal...')

        // Guardar informações da alocação pendente
        setPendingAllocation({
          resourceId: selectedResourceId,
          priority: priority,
          allocationType: allocationType,
          allocatedMinutes: allocatedMinutes
        })

        setSelectedResourceForModal(selectedResource)
        setMultiDayPlan(plan)
        setShowMultiDayModal(true)

        console.log('[MULTI-DAY-DEBUG] Estado do modal multi-dia atualizado!')
      } else {
        console.log('[MULTI-DAY-DEBUG] ✅ Sem overflow ou overflow resolvido automaticamente')
      }
      */
    }

    detectOverflow()
  }, [selectedResourceId, allocationType, allocatedMinutes, allocationId, allResources, allAllocations, task, priority])

  async function handleAllocate() {
    if (!selectedResourceId) {
      alert('Selecione uma pessoa')
      return
    }

    // Check for task dates
    if (!task.start_date || !task.end_date) {
      alert('Esta tarefa não possui datas definidas')
      return
    }

    setIsSaving(true)
    setConflicts([])
    setShowConflictWarning(false)

    try {
      // ONDA 3: Verificação de conflitos (só para novas alocações)
      // NOTA: A detecção de overflow já aconteceu automaticamente quando o recurso foi selecionado
      // IMPORTANTE: Agora só verificamos eventos pessoais bloqueantes
      // Conflitos de alocação são tratados pelo sistema de overflow acima
      if (!allocationId) {
        const availabilityCheck = await checkResourceAvailability(
          selectedResourceId,
          task.start_date,
          task.end_date
        )

        // Filtrar apenas conflitos de eventos pessoais bloqueantes
        const personalEventConflicts = availabilityCheck.conflicts.filter(c => c.type === 'personal_event_block')

        // Só bloquear se houver eventos pessoais bloqueantes (férias, folga, etc)
        if (personalEventConflicts.length > 0) {
          setConflicts(personalEventConflicts)
          setConflictingPriorities([])
          setShowConflictWarning(true)
          setAllowOverride(false)  // Não permitir override de eventos pessoais
          setIsSaving(false)
          return
        }

        // Conflitos de alocação (allocation_overlap) agora são ignorados aqui
        // O sistema de overflow cuida disso baseado em capacidade real
      }

      // ONDA 3: UPDATE se estiver editando, INSERT se for nova alocação
      let error
      if (allocationId) {
        // Modo de edição: UPDATE
        const { error: updateError } = await supabase
          .from('allocations')
          .update({
            priority: priority,
            allocated_minutes: allocationType === 'partial' ? allocatedMinutes : null,
            overtime_minutes: hasOvertime ? overtimeMinutes : 0,
            overtime_multiplier: hasOvertime ? overtimeMultiplier : 1.5
          })
          .eq('id', allocationId)

        error = updateError
      } else {
        // Modo de criação: INSERT
        const { error: insertError } = await supabase
          .from('allocations')
          .insert({
            resource_id: selectedResourceId,
            task_id: task.id,
            priority: priority,
            start_date: task.start_date,
            end_date: task.end_date,
            allocated_minutes: allocationType === 'partial' ? allocatedMinutes : null,
            overtime_minutes: hasOvertime ? overtimeMinutes : 0,
            overtime_multiplier: hasOvertime ? overtimeMultiplier : 1.5
          })

        error = insertError
      }

      if (error) throw error

      // Atualizar custo real da tarefa
      await updateTaskActualCost(task.id)

      showSuccessAlert(allocationId ? 'Alocação atualizada com sucesso!' : 'Recurso alocado com sucesso!')

      // Reset form
      setSelectedResourceId('')
      setPriority('media')
      setConflicts([])
      setShowConflictWarning(false)

      // Refresh global allocations
      await refreshAllocations()
      onSuccess()
    } catch (error: any) {
      if (error.code === '23505') {
        alert('Esta pessoa já está alocada nesta tarefa')
      } else {
        logError(error, 'handleAllocate')
        showErrorAlert(error, ErrorContext.ALLOCATION_CREATE)
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleForceAllocate() {
    // Force allocation even with conflicts (only for allocation overlaps)
    setIsSaving(true)

    try {
      // ONDA 3: Include allocated_minutes + overtime_minutes + overtime_multiplier
      const { error } = await supabase
        .from('allocations')
        .insert({
          resource_id: selectedResourceId,
          task_id: task.id,
          priority: priority,
          start_date: task.start_date,
          end_date: task.end_date,
          allocated_minutes: allocationType === 'partial' ? allocatedMinutes : null,
          overtime_minutes: hasOvertime ? overtimeMinutes : 0,
          overtime_multiplier: hasOvertime ? overtimeMultiplier : 1.5
        })

      if (error) throw error

      // Atualizar custo real da tarefa
      await updateTaskActualCost(task.id)

      showSuccessAlert('Recurso alocado com prioridade diferenciada!')

      // Reset form
      setSelectedResourceId('')
      setPriority('media')
      setConflicts([])
      setConflictingPriorities([])
      setShowConflictWarning(false)
      setAllowOverride(false)

      // Refresh global allocations
      await refreshAllocations()
      onSuccess()
    } catch (error: any) {
      if (error.code === '23505') {
        alert('Esta pessoa já está alocada nesta tarefa')
      } else {
        logError(error, 'handleForceAllocate')
        showErrorAlert(error, ErrorContext.ALLOCATION_CREATE)
      }
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * ONDA 3: Lidar com a decisão do usuário no modal de hora extra
   */
  async function handleOvertimeDecision(option: OvertimeOption) {
    if (!pendingAllocation) return
    if (!overflowResult) {
      console.error('[OVERFLOW-DEBUG] overflowResult não encontrado!')
      return
    }

    setShowOvertimeDecisionModal(false)
    setIsSaving(true)

    try {
      const { resourceId, priority, allocationType, allocatedMinutes } = pendingAllocation

      let allocationData: any = {
        resource_id: resourceId,
        task_id: task.id,
        priority: priority,
        start_date: task.start_date,
        end_date: task.end_date,
        allocated_minutes: allocationType === 'partial' ? allocatedMinutes : null,
        overtime_minutes: 0,
        overtime_multiplier: 1.5
      }

      // Aplicar a opção escolhida
      console.log('[OVERFLOW-DEBUG] Aplicando opção:', option.type)

      switch (option.type) {
        case 'push_date':
          // Empurrar para próximo dia (sem hora extra)
          // IMPORTANTE: Criar 2 alocações - uma no dia atual (capacidade disponível) + uma no próximo dia (resto)
          console.log('[OVERFLOW-DEBUG] Push date:', {
            oldDate: task.end_date,
            newDate: option.newEndDate,
            minutesAvailable: overflowResult?.minutesAvailable,
            minutesOverflow: overflowResult?.minutesOverflow
          })

          if (!overflowResult) {
            throw new Error('overflowResult não encontrado para push_date')
          }

          // Se há capacidade disponível no dia atual, criar alocação para usar essa capacidade
          if (overflowResult.minutesAvailable > 0) {
            console.log('[OVERFLOW-DEBUG] Criando alocação 1/2 (dia atual):', {
              date: task.start_date,
              minutes: overflowResult.minutesAvailable
            })

            const { error: firstAllocError } = await supabase
              .from('allocations')
              .insert({
                resource_id: resourceId,
                task_id: task.id,
                priority: priority,
                start_date: task.start_date,
                end_date: task.start_date,
                allocated_minutes: overflowResult.minutesAvailable,
                overtime_minutes: 0,
                overtime_multiplier: 1.0
              })

            if (firstAllocError) {
              console.error('[OVERFLOW-DEBUG] Erro ao criar primeira alocação:', firstAllocError)
              throw firstAllocError
            }

            console.log('[OVERFLOW-DEBUG] Primeira alocação criada com sucesso!')
          }

          // Segunda alocação: resto no próximo dia
          console.log('[OVERFLOW-DEBUG] Criando alocação 2/2 (próximo dia):', {
            date: option.newEndDate,
            minutes: overflowResult.minutesOverflow
          })

          allocationData.start_date = option.newEndDate
          allocationData.end_date = option.newEndDate
          allocationData.allocated_minutes = overflowResult.minutesOverflow

          // IMPORTANTE: Atualizar a data de fim da tarefa também!
          console.log('[OVERFLOW-DEBUG] Atualizando data de fim da tarefa...')
          const { error: taskUpdateError } = await supabase
            .from('tasks')
            .update({ end_date: option.newEndDate })
            .eq('id', task.id)

          if (taskUpdateError) {
            console.error('[OVERFLOW-DEBUG] Erro ao atualizar tarefa:', taskUpdateError)
            throw taskUpdateError
          }
          console.log('[OVERFLOW-DEBUG] Tarefa atualizada com sucesso!')
          break

        case 'overtime_weekday':
          // Usar hora extra em dia útil (1.5×) - COM LIMITE CLT DE 2H
          const MAX_OVERTIME_WEEKDAY_MINUTES = 120
          const totalOverflow = overflowResult.minutesOverflow
          const overtimeToday = Math.min(totalOverflow, MAX_OVERTIME_WEEKDAY_MINUTES)
          const exceededOvertime = totalOverflow - overtimeToday

          console.log('[OVERFLOW-DEBUG] Overtime weekday com limite CLT:', {
            totalOverflow,
            overtimeToday,
            exceededOvertime,
            multiplier: option.multiplier
          })

          // Primeira alocação: capacidade disponível hoje + hora extra (max 2h)
          allocationData.allocated_minutes = overflowResult.minutesAvailable
          allocationData.overtime_minutes = overtimeToday
          allocationData.overtime_multiplier = 1.5

          // Se há excedente além das 2h, criar segunda alocação no próximo dia
          if (exceededOvertime > 0) {
            console.log('[OVERFLOW-DEBUG] Excedente de', exceededOvertime, 'minutos será alocado no próximo dia')

            // Calcular próximo dia útil
            const nextDay = new Date(task.start_date + 'T00:00:00')
            nextDay.setDate(nextDay.getDate() + 1)
            while ([0, 6].includes(nextDay.getDay())) {
              nextDay.setDate(nextDay.getDate() + 1)
            }
            const nextDayStr = nextDay.toISOString().split('T')[0]

            // Atualizar end_date da tarefa
            const { error: taskUpdateError } = await supabase
              .from('tasks')
              .update({ end_date: nextDayStr })
              .eq('id', task.id)

            if (taskUpdateError) throw taskUpdateError

            // Marcar que haverá segunda alocação (será criada após a primeira)
            allocationData._createSecondAllocation = {
              date: nextDayStr,
              minutes: exceededOvertime
            }
          }

          console.log('[OVERFLOW-DEBUG] Alocação configurada:', allocationData)
          break

        case 'overtime_weekend':
          // Trabalhar no fim de semana (2.0×)
          console.log('[OVERFLOW-DEBUG] Overtime weekend:', {
            overtimeMinutes: option.overtimeMinutes,
            multiplier: option.multiplier,
            newDate: option.newEndDate
          })
          allocationData.overtime_minutes = option.overtimeMinutes
          allocationData.overtime_multiplier = option.multiplier

          if (option.newEndDate) {
            allocationData.start_date = option.newEndDate
            allocationData.end_date = option.newEndDate

            // IMPORTANTE: Atualizar a data de fim da tarefa para o fim de semana
            console.log('[OVERFLOW-DEBUG] Atualizando data de fim da tarefa para fim de semana...')
            const { error: taskUpdateError2 } = await supabase
              .from('tasks')
              .update({ end_date: option.newEndDate })
              .eq('id', task.id)

            if (taskUpdateError2) {
              console.error('[OVERFLOW-DEBUG] Erro ao atualizar tarefa:', taskUpdateError2)
              throw taskUpdateError2
            }
            console.log('[OVERFLOW-DEBUG] Tarefa atualizada para fim de semana:', option.newEndDate)
          }
          break
      }

      console.log('[OVERFLOW-DEBUG] Dados da alocação:', allocationData)

      // Verificar se há segunda alocação pendente (limite CLT)
      const secondAllocationData = allocationData._createSecondAllocation
      delete allocationData._createSecondAllocation // Remover flag temporária

      // Inserir alocação com configuração escolhida
      // NOTA: Para push_date, a segunda alocação já foi configurada acima
      // Para overtime, inserir a alocação única com hora extra
      if (option.type !== 'push_date') {
        const { error } = await supabase
          .from('allocations')
          .insert(allocationData)

        if (error) throw error

        console.log('[OVERFLOW-DEBUG] Alocação criada com sucesso!')

        // Se há segunda alocação (excedente CLT), criar agora
        if (secondAllocationData) {
          console.log('[OVERFLOW-DEBUG] Criando segunda alocação (excedente CLT):', secondAllocationData)

          const { error: secondError } = await supabase
            .from('allocations')
            .insert({
              resource_id: pendingAllocation.resourceId,
              task_id: task.id,
              priority: pendingAllocation.priority,
              start_date: secondAllocationData.date,
              end_date: secondAllocationData.date,
              allocated_minutes: secondAllocationData.minutes,
              overtime_minutes: 0,
              overtime_multiplier: 1.0
            })

          if (secondError) throw secondError

          console.log('[OVERFLOW-DEBUG] Segunda alocação (excedente) criada com sucesso!')
        }
      } else {
        // Para push_date, inserir apenas a segunda alocação (primeira já foi criada no switch)
        const { error } = await supabase
          .from('allocations')
          .insert(allocationData)

        if (error) throw error

        console.log('[OVERFLOW-DEBUG] Segunda alocação criada com sucesso!')
      }

      // Atualizar custo real da tarefa
      await updateTaskActualCost(task.id)

      const message = option.type === 'push_date'
        ? 'Recurso alocado para o próximo dia útil!'
        : option.type === 'overtime_weekday'
        ? 'Recurso alocado com hora extra em dia útil!'
        : 'Recurso alocado para trabalho no fim de semana!'

      showSuccessAlert(message)

      // Reset form
      setSelectedResourceId('')
      setPriority('media')
      setPendingAllocation(null)
      setOverflowResult(null)
      setOvertimeOptions([])
      setSelectedResourceForModal(null)

      // Refresh global allocations
      await refreshAllocations()
      onSuccess()
    } catch (error: any) {
      if (error.code === '23505') {
        alert('Esta pessoa já está alocada nesta tarefa')
      } else {
        logError(error, 'handleOvertimeDecision')
        showErrorAlert(error, ErrorContext.ALLOCATION_CREATE)
      }
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Cancelar decisão de hora extra
   */
  function handleCancelOvertimeDecision() {
    setShowOvertimeDecisionModal(false)
    setPendingAllocation(null)
    setOverflowResult(null)
    setOvertimeOptions([])
    setSelectedResourceForModal(null)
    setIsSaving(false)
  }

  /**
   * ONDA 3.5: Processar decisões do modal multi-dia
   */
  async function handleMultiDayDecisions(decisions: DayDecision[]) {
    console.log('[MULTI-DAY-DEBUG] Decisões recebidas:', decisions)

    if (!pendingAllocation || !multiDayPlan || !selectedResourceForModal) {
      console.error('[MULTI-DAY-DEBUG] Dados pendentes não encontrados!')
      return
    }

    setShowMultiDayModal(false)
    setIsSaving(true)

    try {
      const { resourceId, priority } = pendingAllocation

      // 🌊 ONDA 4.4: Mapear decisões de overflow E fim de semana
      const overflowDecisionsMap = new Map(decisions.map(d => [d.date, d]))
      const weekendDecisionsMap = new Map(weekendDecisions.map(d => [d.date, d]))

      console.log('[MULTI-DAY-DEBUG] 🌊 ONDA 4.4: Decisões de fim de semana:', Array.from(weekendDecisionsMap.entries()))

      // Para cada dia do plano, criar alocação
      const allocationsToCreate: any[] = []
      let remainingMinutes = pendingAllocation.allocatedMinutes
      const dailyCapacity = selectedResourceForModal.daily_capacity_minutes || 540

      console.log('[MULTI-DAY-DEBUG] Criando alocações para', remainingMinutes, 'minutos totais')
      console.log('[MULTI-DAY-DEBUG] Plano tem', multiDayPlan.days.length, 'dias')
      console.log('[MULTI-DAY-DEBUG] Decisões de overflow:', Array.from(overflowDecisionsMap.entries()))

      // 🌊 ONDA 4.4: Processar CRONOLOGICAMENTE - incluindo fins de semana
      let currentDate = new Date(task.start_date + 'T00:00:00')
      const maxDays = 60 // Segurança

      for (let dayIndex = 0; dayIndex < maxDays && remainingMinutes > 0; dayIndex++) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const dayOfWeek = currentDate.getDay() // 0 = domingo, 6 = sábado
        const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6

        console.log('[MULTI-DAY-DEBUG] 📅 Processando dia:', dateStr, { isWeekend: isWeekendDay, remainingMinutes })

        let normalMinutes = 0
        let overtimeMinutes = 0
        let overtimeMultiplier = 1.0

        // 🌊 ONDA 4.4: Verificar se é FIM DE SEMANA
        if (isWeekendDay) {
          const weekendDecision = weekendDecisionsMap.get(dateStr)

          if (weekendDecision?.useWeekend) {
            // Usuário escolheu TRABALHAR no fim de semana
            console.log('[WEEKEND-DEBUG] 🏖️ Trabalhando no fim de semana:', dateStr)
            normalMinutes = Math.min(remainingMinutes, weekendDecision.minutesToWork)
            overtimeMinutes = normalMinutes // TODO FIM DE SEMANA É TUDO OVERTIME
            normalMinutes = 0 // Zerar normal pois tudo é overtime
            overtimeMultiplier = 2.0 // Fim de semana sempre 2.0×
            remainingMinutes -= overtimeMinutes
          } else {
            // Usuário escolheu PULAR fim de semana
            console.log('[WEEKEND-DEBUG] ⏭️ Pulando fim de semana:', dateStr)
            currentDate.setDate(currentDate.getDate() + 1)
            continue
          }
        } else {
          // DIA ÚTIL - processar normalmente
          const overflowDecision = overflowDecisionsMap.get(dateStr)
          const dayPlan = multiDayPlan.days.find(d => d.date === dateStr)

          if (dayPlan?.hasOverflow) {
            // Dia com overflow - verificar decisão do usuário
            if (overflowDecision?.useOvertime) {
              // Usuário escolheu usar hora extra
              normalMinutes = Math.min(remainingMinutes, dayPlan.normalMinutes)
              overtimeMinutes = Math.min(overflowDecision.overtimeMinutes, remainingMinutes - normalMinutes)
              overtimeMultiplier = overflowDecision.overtimeMultiplier
              remainingMinutes -= (normalMinutes + overtimeMinutes)
            } else {
              // Usuário escolheu empurrar - alocar apenas capacidade normal
              normalMinutes = Math.min(remainingMinutes, dayPlan.normalMinutes)
              remainingMinutes -= normalMinutes
            }
          } else {
            // Dia sem overflow - alocar tudo que cabe (dias finais)
            normalMinutes = Math.min(remainingMinutes, dailyCapacity)
            remainingMinutes -= normalMinutes
          }
        }

        console.log('[MULTI-DAY-DEBUG] Dia', dateStr, {
          isWeekend: isWeekendDay,
          normalMinutes,
          overtimeMinutes,
          overtimeMultiplier,
          remainingMinutes
        })

        // Criar alocação
        if (normalMinutes > 0 || overtimeMinutes > 0) {
          allocationsToCreate.push({
            resource_id: resourceId,
            task_id: task.id,
            priority,
            start_date: dateStr,
            end_date: dateStr,
            allocated_minutes: normalMinutes,
            overtime_minutes: overtimeMinutes,
            overtime_multiplier: overtimeMultiplier
          })
        }

        // Avançar para o próximo dia
        currentDate.setDate(currentDate.getDate() + 1)
      }

      // Inserir todas as alocações
      console.log('[MULTI-DAY-DEBUG] Inserindo', allocationsToCreate.length, 'alocações')
      const { error } = await supabase
        .from('allocations')
        .insert(allocationsToCreate)

      if (error) throw error

      // Atualizar end_date da tarefa se necessário
      const lastAllocation = allocationsToCreate[allocationsToCreate.length - 1]
      if (lastAllocation && lastAllocation.end_date !== task.end_date) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ end_date: lastAllocation.end_date })
          .eq('id', task.id)

        if (taskError) throw taskError
      }

      // Atualizar custo real da tarefa
      await updateTaskActualCost(task.id)

      showSuccessAlert(`${allocationsToCreate.length} alocações criadas com sucesso!`)

      // Reset
      setSelectedResourceId('')
      setPriority('media')
      setPendingAllocation(null)
      setMultiDayPlan(null)
      setSelectedResourceForModal(null)
      setShowMultiDayModal(false)

      // Refresh
      await refreshAllocations()
      onSuccess()
    } catch (error: any) {
      console.error('[MULTI-DAY-DEBUG] Erro ao criar alocações:', error)
      showErrorAlert('Erro ao criar alocações multi-dia')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * ONDA 3.5: Cancelar modal multi-dia
   */
  function handleCancelMultiDayDecision() {
    setShowMultiDayModal(false)
    setPendingAllocation(null)
    setMultiDayPlan(null)
    setSelectedResourceForModal(null)
    setIsSaving(false)
  }

  /**
   * 🌊 ONDA 4.3: Processar decisões do modal de fim de semana
   */
  function handleWeekendDecisions(decisions: WeekendDecision[]) {
    console.log('[WEEKEND-DEBUG] 🎉 Decisões de fim de semana recebidas:', decisions)

    // Armazenar decisões
    setWeekendDecisions(decisions)
    setShowWeekendModal(false)

    // Agora abrir modal de overflow (se necessário)
    if (multiDayPlan?.requiresUserDecision) {
      console.log('[WEEKEND-DEBUG] → Abrindo modal de overflow agora...')
      setShowMultiDayModal(true)
    } else {
      console.log('[WEEKEND-DEBUG] ✅ Sem overflow - criando alocações direto')
      // TODO: Criar alocações com decisões de fim de semana
    }
  }

  /**
   * 🌊 ONDA 4.3: Cancelar modal de fim de semana
   */
  function handleCancelWeekendDecision() {
    setShowWeekendModal(false)
    setPendingAllocation(null)
    setMultiDayPlan(null)
    setWeekendDays([])
    setWeekendDecisions([])
    setSelectedResourceForModal(null)
    setIsSaving(false)
  }

  /**
   * 🌊 ONDA 5: Processar fragmentos do Planner
   */
  async function handlePlannerConfirm(fragments: AllocationFragment[]) {
    console.log('[PLANNER-DEBUG] Fragmentos recebidos:', fragments)

    if (!pendingAllocation || !selectedResourceForModal) {
      console.error('[PLANNER-DEBUG] Dados pendentes não encontrados!')
      return
    }

    setShowPlanner(false)
    setIsSaving(true)

    try {
      const { resourceId, priority } = pendingAllocation

      // 🔄 MODO DE EDIÇÃO: Verificar se já existem alocações deste recurso
      const existingResourceAllocations = existingAllocations.filter(a => a.resource_id === resourceId)
      const isEditMode = existingResourceAllocations.length > 0

      if (isEditMode) {
        console.log('[PLANNER-DEBUG] Modo de edição - deletando alocações antigas')

        // Deletar TODAS as alocações deste recurso nesta tarefa
        const { error: deleteError } = await supabase
          .from('allocations')
          .delete()
          .eq('task_id', task.id)
          .eq('resource_id', resourceId)

        if (deleteError) {
          console.error('[PLANNER-DEBUG] Erro ao deletar alocações antigas:', deleteError)
          throw deleteError
        }
      }

      // Criar alocações para cada fragmento
      const allocationsToCreate = fragments.map(fragment => ({
        resource_id: resourceId,
        task_id: task.id,
        priority,
        start_date: fragment.start_date,
        end_date: fragment.end_date,
        allocated_minutes: fragment.allocated_minutes,
        overtime_minutes: fragment.overtime_minutes,
        overtime_multiplier: fragment.overtime_multiplier
      }))

      console.log('[PLANNER-DEBUG] Criando alocações:', allocationsToCreate)

      // Inserir todas as alocações
      const { error: insertError } = await supabase
        .from('allocations')
        .insert(allocationsToCreate)

      if (insertError) {
        console.error('[PLANNER-DEBUG] Erro ao inserir alocações:', insertError)
        throw insertError
      }

      // 🔄 Atualizar end_date da tarefa baseado no último fragmento de TODOS os recursos
      // Buscar todas as alocações da tarefa (incluindo as que acabamos de inserir)
      const { data: allTaskAllocations, error: fetchError } = await supabase
        .from('allocations')
        .select('end_date')
        .eq('task_id', task.id)
        .order('end_date', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error('[PLANNER-DEBUG] Erro ao buscar alocações para atualizar end_date:', fetchError)
      } else if (allTaskAllocations && allTaskAllocations.length > 0) {
        const latestEndDate = allTaskAllocations[0].end_date
        console.log('[PLANNER-DEBUG] Atualizando end_date da tarefa para:', latestEndDate)

        const { error: updateTaskError } = await supabase
          .from('tasks')
          .update({ end_date: latestEndDate })
          .eq('id', task.id)

        if (updateTaskError) {
          console.error('[PLANNER-DEBUG] Erro ao atualizar end_date da tarefa:', updateTaskError)
          // Não lançar erro, apenas logar
        }
      }

      // Atualizar custo real da tarefa
      await updateTaskActualCost(task.id)

      const message = isEditMode
        ? `Alocação atualizada com sucesso (${fragments.length} fragmento(s))`
        : `${fragments.length} alocação(ões) criada(s) com sucesso`

      showSuccessAlert(message)

      // Refresh
      await refreshAllocations()
      onSuccess()
    } catch (error) {
      logError(error as Error, ErrorContext.AllocationCreate)
      showErrorAlert('Erro ao criar alocações')
    } finally {
      setIsSaving(false)
      setPendingAllocation(null)
      setMultiDayPlan(null)
      setSelectedResourceForModal(null)
      setExistingFragmentsForEdit([])
    }
  }

  /**
   * 🌊 ONDA 5: Cancelar Planner
   */
  function handlePlannerCancel() {
    setShowPlanner(false)
    setPendingAllocation(null)
    setMultiDayPlan(null)
    setSelectedResourceForModal(null)
    setExistingFragmentsForEdit([])
    setIsSaving(false)
  }

  async function handleRemoveAllocation(allocationId: string) {
    if (!confirm('Deseja remover esta alocação?')) return

    try {
      const { error } = await supabase
        .from('allocations')
        .delete()
        .eq('id', allocationId)

      if (error) throw error

      showSuccessAlert('Alocação removida com sucesso')

      // Refresh global allocations
      await refreshAllocations()
      onSuccess()
    } catch (error) {
      logError(error, 'removeAllocation')
      showErrorAlert(error, ErrorContext.ALLOCATION_DELETE)
    }
  }

  // Separar recursos por papel
  const allocatedResourceIds = existingAllocations.map(a => a.resource_id)

  // Líderes alocados na tarefa atual
  const allocatedLeaders = existingAllocations
    .map(a => allResources.find(r => r.id === a.resource_id))
    .filter(r => r && (r.hierarchy === 'lider' || r.hierarchy === 'gerente'))
    .filter(Boolean) as Resource[]

  // ✅ HERANÇA DE LÍDERES: Se esta é uma subtarefa, buscar líderes da tarefa pai
  const parentTaskLeaders = useMemo(() => {
    if (!task.parent_id) return []

    // Buscar alocações da tarefa pai
    const parentAllocations = allAllocations.filter(a => a.task_id === task.parent_id)

    // Extrair líderes alocados na tarefa pai
    return parentAllocations
      .map(a => allResources.find(r => r.id === a.resource_id))
      .filter(r => r && (r.hierarchy === 'lider' || r.hierarchy === 'gerente'))
      .filter(Boolean) as Resource[]
  }, [task.parent_id, allAllocations, allResources])

  // Combinar líderes da tarefa atual + líderes herdados da tarefa pai (sem duplicatas)
  const allEffectiveLeaders = useMemo(() => {
    const combined = [...allocatedLeaders, ...parentTaskLeaders]
    const uniqueLeaderIds = new Set(combined.map(l => l.id))
    return Array.from(uniqueLeaderIds).map(id => combined.find(l => l.id === id)!).filter(Boolean)
  }, [allocatedLeaders, parentTaskLeaders])

  // IDs dos líderes efetivos (incluindo herdados)
  const allocatedLeaderIds = allEffectiveLeaders.map(l => l.id)

  // Líderes disponíveis (não alocados ainda)
  const availableLeaders = allResources.filter(r =>
    (r.hierarchy === 'lider' || r.hierarchy === 'gerente') &&
    !allocatedResourceIds.includes(r.id)
  )

  // Operadores dos líderes alocados
  const operatorsOfAllocatedLeaders = allResources.filter(r =>
    r.hierarchy === 'operador' &&
    r.leader_id &&
    allocatedLeaderIds.includes(r.leader_id) &&
    !allocatedResourceIds.includes(r.id)
  )

  // Agrupar operadores por líder (usar líderes efetivos, incluindo herdados)
  const operatorsByLeader = allEffectiveLeaders.map(leader => ({
    leader,
    operators: operatorsOfAllocatedLeaders.filter(op => op.leader_id === leader.id),
    isInherited: parentTaskLeaders.some(pl => pl.id === leader.id) && !allocatedLeaders.some(al => al.id === leader.id)
  }))

  // Todas as alocações com detalhes dos recursos
  const allocationsWithResources = existingAllocations
    .map(allocation => ({
      ...allocation,
      resource: allResources.find(r => r.id === allocation.resource_id)
    }))
    .filter(a => a.resource)

  // Debug: Log quando o modal deveria aparecer mas o recurso não foi encontrado
  if (showOvertimeDecisionModal && !selectedResourceForModal) {
    console.error('[OVERFLOW-DEBUG] ❌ Modal deveria abrir mas recurso não foi encontrado:', {
      selectedResourceId,
      totalResources: allResources.length,
      resourceIds: allResources.map(r => r.id),
      selectedResourceForModalState: selectedResourceForModal
    })
  }

  return (
    <>
      {/* ONDA 3: Modal de Decisão de Hora Extra (single day) */}
      {showOvertimeDecisionModal && overflowResult && overtimeOptions.length > 0 && selectedResourceForModal && (
        <OvertimeDecisionModal
          isOpen={showOvertimeDecisionModal}
          resource={selectedResourceForModal}
          overflow={overflowResult}
          options={overtimeOptions}
          onSelect={handleOvertimeDecision}
          onCancel={handleCancelOvertimeDecision}
        />
      )}

      {/* 🌊 ONDA 5: Planner Visual (substitui modais de Weekend e MultiDay) */}
      {showPlanner && selectedResourceForModal && task.start_date && (
        <AllocationPlanner
          taskName={task.name}
          taskStartDate={task.start_date}
          totalMinutes={task.duration_minutes || 0}
          resourceName={selectedResourceForModal.name}
          resourceId={selectedResourceForModal.id}
          resourceHourlyRate={selectedResourceForModal.hourly_rate || 0}
          resourceDailyCapacityMinutes={selectedResourceForModal.daily_capacity_minutes || 540}
          onConfirm={handlePlannerConfirm}
          onCancel={handlePlannerCancel}
          editMode={existingFragmentsForEdit.length > 0}
          existingFragments={existingFragmentsForEdit}
        />
      )}

      {/* 🌊 ONDA 5: Modais antigos DESATIVADOS (mantidos para possível reativação) */}
      {/*
      {showWeekendModal && weekendDays.length > 0 && selectedResourceForModal && (
        <WeekendDecisionModal
          weekends={weekendDays}
          resourceName={selectedResourceForModal.name}
          resourceHourlyRate={selectedResourceForModal.hourly_rate || 0}
          taskName={task.name}
          totalMinutes={task.duration_minutes || 0}
          onConfirm={handleWeekendDecisions}
          onCancel={handleCancelWeekendDecision}
        />
      )}

      {showMultiDayModal && multiDayPlan && selectedResourceForModal && (
        <MultiDayAllocationModal
          plan={multiDayPlan}
          resourceName={selectedResourceForModal.name}
          resourceHourlyRate={selectedResourceForModal.hourly_rate || 0}
          taskName={task.name}
          onConfirm={handleMultiDayDecisions}
          onCancel={handleCancelMultiDayDecision}
        />
      )}
      */}

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {allocationId ? '✏️ Editar Alocação' : '👥 Alocar Pessoa'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Tarefa: {task.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-600">
            Carregando...
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Alocações Existentes - 🌊 ONDA 5.2 */}
            {allocationsWithResources.length > 0 && (() => {
              // Agrupar alocações por recurso (para mostrar fragmentação)
              const allocationsByResource = allocationsWithResources.reduce((acc, allocation) => {
                const resourceId = allocation.resource_id
                if (!acc[resourceId]) {
                  acc[resourceId] = []
                }
                acc[resourceId].push(allocation)
                return acc
              }, {} as Record<string, typeof allocationsWithResources>)

              return (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Pessoas Alocadas ({Object.keys(allocationsByResource).length})
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(allocationsByResource).map(([resourceId, resourceAllocations]) => {
                      const resource = resourceAllocations[0].resource!
                      const isFragmented = resourceAllocations.length > 1

                      // Ordenar fragmentos por data
                      const sortedFragments = [...resourceAllocations].sort(
                        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
                      )

                      // Calcular total de minutos
                      const totalMinutes = sortedFragments.reduce(
                        (sum, frag) => sum + (frag.allocated_minutes ?? 0) + (frag.overtime_minutes || 0),
                        0
                      )

                      // Montar descrição dos fragmentos
                      const fragmentDescription = isFragmented
                        ? `${sortedFragments.length} fragmentos: ${sortedFragments.map((frag, idx) => {
                            const start = new Date(frag.start_date + 'T00:00:00')
                            const end = new Date(frag.end_date + 'T00:00:00')
                            const isSameDate = frag.start_date === frag.end_date

                            if (isSameDate) {
                              return start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                            } else {
                              return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}-${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                            }
                          }).join(', ')}`
                        : `${new Date(sortedFragments[0].start_date + 'T00:00:00').toLocaleDateString('pt-BR')} - ${new Date(sortedFragments[0].end_date + 'T00:00:00').toLocaleDateString('pt-BR')}`

                      // Verificar se tem overtime
                      const hasOvertime = sortedFragments.some(f => (f.overtime_minutes || 0) > 0)

                      return (
                        <div
                          key={resourceId}
                          className="p-3 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3 flex-1">
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                                {resource.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{resource.name}</p>
                                <p className="text-xs text-gray-500">
                                  {resource.hierarchy === 'gerente' ? '👔 Gerente' :
                                   resource.hierarchy === 'lider' ? '👨‍💼 Líder' :
                                   '👷 Operador'}
                                  {resource.role && ` - ${resource.role}`}
                                </p>
                              </div>
                              <span className={`px-2 py-1 text-xs rounded-full ${PRIORITY_CONFIG[sortedFragments[0].priority].color}`}>
                                {PRIORITY_CONFIG[sortedFragments[0].priority].label}
                              </span>
                            </div>
                          </div>

                          {/* Informações de Fragmentação */}
                          <div className="ml-13 mb-2 space-y-1">
                            <p className="text-xs text-gray-600">
                              📅 {fragmentDescription}
                            </p>
                            <p className="text-xs text-gray-600">
                              ⏱️ Total: {formatMinutes(totalMinutes)}
                              {hasOvertime && <span className="ml-1 text-orange-600 font-semibold">+ Hora Extra</span>}
                            </p>
                          </div>

                          {/* Botões de Ação */}
                          <div className="ml-13 flex gap-2">
                            <button
                              onClick={() => openPlannerForEdit(resourceId)}
                              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors border border-blue-300"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Deseja remover todas as alocações de ${resource.name}?`)) return

                                try {
                                  // Deletar TODAS as alocações deste recurso nesta tarefa
                                  const { error } = await supabase
                                    .from('allocations')
                                    .delete()
                                    .eq('task_id', task.id)
                                    .eq('resource_id', resourceId)

                                  if (error) throw error

                                  showSuccessAlert('Alocações removidas com sucesso')
                                  await refreshAllocations()
                                  onSuccess()
                                } catch (error) {
                                  logError(error, 'removeAllocations')
                                  showErrorAlert(error, ErrorContext.ALLOCATION_DELETE)
                                }
                              }}
                              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Nova Alocação */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Nova Alocação
              </h4>

              {/* Info sobre líderes herdados */}
              {parentTaskLeaders.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  ℹ️ Esta subtarefa herda {parentTaskLeaders.length} {parentTaskLeaders.length === 1 ? 'líder' : 'líderes'} da tarefa pai.
                  Você pode alocar operadores desses líderes sem precisar alocá-los novamente.
                </div>
              )}

              {/* Seleção de Tipo (Líder ou Operador) - ONDA 3: Desabilitar em modo de edição */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Recurso
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setSelectedRole('lider')
                      setSelectedResourceId('')
                    }}
                    disabled={!!allocationId}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      allocationId
                        ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                        : selectedRole === 'lider'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">👨‍💼 Líder / Gerente</div>
                    <div className="text-xs mt-1 opacity-80">
                      Alocar um líder ou gerente
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRole('operador')
                      setSelectedResourceId('')
                    }}
                    disabled={allEffectiveLeaders.length === 0 || !!allocationId}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      allocationId || allEffectiveLeaders.length === 0
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : selectedRole === 'operador'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">👷 Operador</div>
                    <div className="text-xs mt-1 opacity-80">
                      {allEffectiveLeaders.length === 0
                        ? 'Aloque um líder primeiro'
                        : 'Alocar operador de um líder'
                      }
                    </div>
                  </button>
                </div>
              </div>

              {/* Seleção de Líder */}
              {selectedRole === 'lider' && (
                <div>
                  {availableLeaders.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                      ⚠️ Todos os líderes disponíveis já estão alocados nesta tarefa.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Selecionar Líder / Gerente
                        </label>
                        <select
                          value={selectedResourceId}
                          onChange={(e) => setSelectedResourceId(e.target.value)}
                          disabled={!!allocationId}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Escolha um líder...</option>
                          {availableLeaders.map(resource => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} {resource.hierarchy === 'gerente' ? '(Gerente)' : '(Líder)'}{resource.role ? ` - ${resource.role}` : ''}
                            </option>
                          ))}
                        </select>
                        {allocationId && (
                          <p className="text-xs text-gray-500 mt-1">
                            ℹ️ O recurso não pode ser alterado durante a edição
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Seleção de Operador */}
              {selectedRole === 'operador' && (
                <div>
                  {operatorsOfAllocatedLeaders.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                      ⚠️ Não há operadores disponíveis dos líderes alocados.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Mostrar operadores agrupados por líder */}
                      {operatorsByLeader.map(({ leader, operators, isInherited }) => (
                        operators.length > 0 && (
                          <div key={leader.id} className={`border rounded-lg p-3 ${isInherited ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                              <span>👨‍💼 Equipe de {leader.name}</span>
                              {isInherited && (
                                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full" title="Líder alocado na tarefa pai">
                                  Herdado da tarefa pai
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {operators.map(operator => (
                                <label
                                  key={operator.id}
                                  className={`flex items-center p-2 rounded transition-colors ${
                                    allocationId
                                      ? 'cursor-not-allowed opacity-50'
                                      : 'cursor-pointer'
                                  } ${
                                    selectedResourceId === operator.id
                                      ? 'bg-blue-100 border-blue-300 border-2'
                                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="operator"
                                    value={operator.id}
                                    checked={selectedResourceId === operator.id}
                                    onChange={(e) => setSelectedResourceId(e.target.value)}
                                    disabled={!!allocationId}
                                    className="mr-3"
                                  />
                                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium mr-2">
                                    {operator.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-gray-900 font-medium">{operator.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Seleção de Prioridade */}
              {selectedResourceId && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridade da Tarefa
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['alta', 'media', 'baixa'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          priority === p
                            ? `${PRIORITY_CONFIG[p].color} border-current`
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {PRIORITY_CONFIG[p].label}
                        </div>
                        <div className="text-xs mt-1 opacity-80">
                          {PRIORITY_CONFIG[p].description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ONDA 3: Tipo de Alocação (Completa ou Parcial) */}
              {selectedResourceId && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Tipo de Alocação
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAllocationType('full')}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        allocationType === 'full'
                          ? 'border-purple-600 bg-purple-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`font-semibold text-sm ${
                        allocationType === 'full' ? 'text-purple-900' : 'text-gray-700'
                      }`}>
                        📋 Completa (100%)
                      </div>
                      <div className="text-xs mt-1 text-gray-600">
                        Recurso trabalha toda a duração da tarefa
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAllocationType('partial')}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        allocationType === 'partial'
                          ? 'border-orange-600 bg-orange-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`font-semibold text-sm ${
                        allocationType === 'partial' ? 'text-orange-900' : 'text-gray-700'
                      }`}>
                        ⏱️ Parcial
                      </div>
                      <div className="text-xs mt-1 text-gray-600">
                        Definir minutos específicos
                      </div>
                    </button>
                  </div>

                  {/* Input para minutos específicos (alocação parcial) */}
                  {allocationType === 'partial' && (
                    <div className="mt-4 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                      <label className="block text-sm font-medium text-orange-900 mb-2">
                        Minutos Alocados
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max={task.duration_minutes}
                          value={allocatedMinutes}
                          onChange={(e) => setAllocatedMinutes(parseInt(e.target.value) || 0)}
                          className="flex-1 px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                          placeholder="Ex: 240"
                        />
                        <span className="text-sm text-orange-700 font-mono whitespace-nowrap">
                          = {(allocatedMinutes / 60).toFixed(1)}h
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-orange-700">
                        <p>
                          Duração total da tarefa: <span className="font-mono">{formatMinutes(task.duration_minutes, 'auto')}</span>
                        </p>
                        <p className="mt-1">
                          Alocando: <span className="font-mono font-semibold">
                            {task.duration_minutes > 0 ? Math.round((allocatedMinutes / task.duration_minutes) * 100) : 0}%
                          </span> da tarefa
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ONDA 3: Hora Extra */}
              {selectedResourceId && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Hora Extra
                    </label>
                    <button
                      type="button"
                      onClick={() => setHasOvertime(!hasOvertime)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        hasOvertime
                          ? 'bg-red-100 text-red-700 border-2 border-red-300'
                          : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                      }`}
                    >
                      {hasOvertime ? '✓ Ativado' : 'Desativado'}
                    </button>
                  </div>

                  {hasOvertime && (
                    <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg space-y-4">
                      {/* Minutos de hora extra */}
                      <div>
                        <label className="block text-sm font-medium text-red-900 mb-2">
                          Minutos de Hora Extra
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            value={overtimeMinutes}
                            onChange={(e) => setOvertimeMinutes(parseInt(e.target.value) || 0)}
                            className="flex-1 px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                            placeholder="Ex: 120"
                          />
                          <span className="text-sm text-red-700 font-mono whitespace-nowrap">
                            = {(overtimeMinutes / 60).toFixed(1)}h
                          </span>
                        </div>
                      </div>

                      {/* Multiplicador de hora extra */}
                      <div>
                        <label className="block text-sm font-medium text-red-900 mb-2">
                          Multiplicador
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setOvertimeMultiplier(1.5)}
                            className={`px-3 py-2 border-2 rounded-lg text-sm font-semibold transition-all ${
                              overtimeMultiplier === 1.5
                                ? 'border-red-600 bg-red-100 text-red-900'
                                : 'border-gray-300 hover:border-red-300 text-gray-700'
                            }`}
                          >
                            50% (×1.5)
                          </button>
                          <button
                            type="button"
                            onClick={() => setOvertimeMultiplier(2.0)}
                            className={`px-3 py-2 border-2 rounded-lg text-sm font-semibold transition-all ${
                              overtimeMultiplier === 2.0
                                ? 'border-red-600 bg-red-100 text-red-900'
                                : 'border-gray-300 hover:border-red-300 text-gray-700'
                            }`}
                          >
                            100% (×2.0)
                          </button>
                          <button
                            type="button"
                            onClick={() => setOvertimeMultiplier(2.5)}
                            className={`px-3 py-2 border-2 rounded-lg text-sm font-semibold transition-all ${
                              overtimeMultiplier === 2.5
                                ? 'border-red-600 bg-red-100 text-red-900'
                                : 'border-gray-300 hover:border-red-300 text-gray-700'
                            }`}
                          >
                            150% (×2.5)
                          </button>
                        </div>
                        <p className="text-xs text-red-700 mt-2">
                          Hora extra será cobrada a {formatCurrency(
                            (selectedResourceId && allResources.find(r => r.id === selectedResourceId)?.hourly_rate || 0) * overtimeMultiplier
                          )}/hora
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info sobre as datas */}
              {/* Preview de duração para o recurso selecionado */}
              {selectedResourceId && task.duration_minutes && (() => {
                const selectedResource = allResources.find(r => r.id === selectedResourceId)
                if (!selectedResource) return null

                const dailyCapacity = selectedResource.daily_capacity_minutes || 540
                const daysNeeded = Math.ceil((task.duration_minutes / dailyCapacity) * 10) / 10

                return (
                  <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">📊</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-purple-900 mb-2">
                          Estimativa para este recurso
                        </h4>
                        <div className="space-y-1.5 text-sm">
                          <p className="text-gray-700">
                            <span className="font-medium text-purple-700">
                              {selectedResource.name}
                            </span>{' '}
                            trabalha{' '}
                            <span className="font-mono bg-white px-2 py-0.5 rounded border border-purple-200">
                              {dailyCapacity / 60}h/dia
                            </span>
                          </p>
                          <p className="text-gray-700">
                            Esta tarefa de{' '}
                            <span className="font-mono bg-white px-2 py-0.5 rounded border border-purple-200">
                              {formatMinutes(task.duration_minutes, 'auto')}
                            </span>{' '}
                            levará aproximadamente:
                          </p>
                          <p className="text-lg font-bold text-purple-900 mt-2">
                            ⏱️ {daysNeeded} dia(s) útil(eis)
                          </p>

                          {/* Cálculo de Custo - ONDA 3: Com hora extra */}
                          {selectedResource.hourly_rate && selectedResource.hourly_rate > 0 && (() => {
                            const effectiveMinutes = allocationType === 'partial' ? allocatedMinutes : task.duration_minutes
                            const totalCost = calculateResourceCost(
                              task.duration_minutes,
                              selectedResource.hourly_rate,
                              allocationType === 'partial' ? allocatedMinutes : null,
                              hasOvertime ? overtimeMinutes : 0,
                              overtimeMultiplier
                            )

                            const regularCost = (effectiveMinutes / 60) * selectedResource.hourly_rate
                            const overtimeCost = hasOvertime ? (overtimeMinutes / 60) * selectedResource.hourly_rate * overtimeMultiplier : 0

                            return (
                              <>
                                <div className="border-t border-purple-200 my-2"></div>
                                <p className="text-gray-700">
                                  <span className="font-medium text-purple-700">Custo deste recurso:</span>
                                </p>
                                <p className="text-lg font-bold text-green-700 mt-1">
                                  💰 {formatCurrency(totalCost)}
                                </p>

                                {/* Breakdown de custo */}
                                <div className="text-xs text-gray-600 mt-2 space-y-1">
                                  <p>
                                    {allocationType === 'partial'
                                      ? `${(allocatedMinutes / 60).toFixed(1)}h (${Math.round((allocatedMinutes / task.duration_minutes) * 100)}% da tarefa)`
                                      : `${(task.duration_minutes / 60).toFixed(1)}h (100% da tarefa)`
                                    } × {formatCurrency(selectedResource.hourly_rate)}/h = {formatCurrency(regularCost)}
                                  </p>
                                  {hasOvertime && overtimeMinutes > 0 && (
                                    <p className="text-red-700 font-semibold">
                                      + {(overtimeMinutes / 60).toFixed(1)}h extra × {formatCurrency(selectedResource.hourly_rate * overtimeMultiplier)}/h = {formatCurrency(overtimeCost)}
                                    </p>
                                  )}
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {task.start_date && task.end_date && selectedResourceId && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  ℹ️ Esta alocação usará as datas da tarefa:
                  <div className="mt-1">
                    <strong>Início:</strong> {formatDateBR(task.start_date)} •
                    <strong> Fim:</strong> {formatDateBR(task.end_date)}
                  </div>
                </div>
              )}

              {/* ✅ Conflict Warning */}
              {showConflictWarning && conflicts.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-red-600 text-xl">⚠️</span>
                    <div className="flex-1">
                      <h5 className="font-bold text-red-900 mb-1">
                        {allowOverride ? 'Conflito Detectado - Priorização Necessária' : 'Conflito Detectado - Não foi possível alocar'}
                      </h5>
                      <p className="text-sm text-red-800 mb-3">
                        {allowOverride
                          ? 'Este recurso já está alocado em outra(s) tarefa(s) no mesmo período:'
                          : 'Este recurso não está disponível no período da tarefa:'
                        }
                      </p>
                      <div className="space-y-2">
                        {conflicts.map((conflict, idx) => (
                          <div key={idx} className="bg-white p-2 rounded border border-red-200 text-sm text-red-900">
                            <div className="font-medium">
                              {conflict.type === 'allocation_overlap' && '📊 Já alocado em outra tarefa'}
                              {conflict.type === 'personal_event_block' && '🚫 Evento pessoal bloqueante'}
                            </div>
                            <div className="text-red-700 mt-1">{conflict.message}</div>
                          </div>
                        ))}
                      </div>

                      {/* Override Option */}
                      {allowOverride && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                          <div className="text-sm text-yellow-900 font-medium mb-2">
                            💡 Você pode alocar com prioridade diferente
                          </div>
                          <p className="text-xs text-yellow-800 mb-3">
                            As tarefas conflitantes têm prioridade: {conflictingPriorities.map(p => PRIORITY_CONFIG[p as 'alta' | 'media' | 'baixa']?.label || p).join(', ')}.
                            Escolha uma prioridade diferente para criar hierarquia entre as tarefas.
                          </p>

                          {/* Priority Selection for Override */}
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-yellow-900">
                              Selecione a prioridade desta alocação:
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['alta', 'media', 'baixa'] as const).map(p => {
                                const isConflicting = conflictingPriorities.includes(p)
                                const isDisabled = isConflicting

                                return (
                                  <button
                                    key={p}
                                    onClick={() => !isDisabled && setPriority(p)}
                                    disabled={isDisabled}
                                    className={`p-2 rounded-lg border-2 text-xs transition-all ${
                                      isDisabled
                                        ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                                        : priority === p
                                        ? `${PRIORITY_CONFIG[p].color} border-current`
                                        : 'border-gray-300 hover:border-gray-400 text-gray-700 bg-white'
                                    }`}
                                  >
                                    <div className="font-medium">
                                      {PRIORITY_CONFIG[p].label}
                                    </div>
                                    {isConflicting && (
                                      <div className="text-xs mt-0.5 text-red-600">
                                        ✗ Já em uso
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Override Action Buttons */}
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={handleForceAllocate}
                              disabled={conflictingPriorities.includes(priority) || isSaving}
                              className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm rounded font-medium hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                              {isSaving ? 'Alocando...' : '✓ Alocar com Prioridade Diferente'}
                            </button>
                            <button
                              onClick={() => {
                                setShowConflictWarning(false)
                                setConflicts([])
                                setConflictingPriorities([])
                                setAllowOverride(false)
                                setSelectedResourceId('')
                              }}
                              className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Cancel button for non-overridable conflicts */}
                      {!allowOverride && (
                        <button
                          onClick={() => {
                            setShowConflictWarning(false)
                            setConflicts([])
                            setConflictingPriorities([])
                            setSelectedResourceId('')
                          }}
                          className="mt-3 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                        >
                          Escolher outro recurso
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAllocate}
            disabled={!selectedResourceId || isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving
              ? (allocationId ? 'Salvando...' : 'Alocando...')
              : (allocationId ? '✓ Salvar Alterações' : '✓ Alocar Pessoa')
            }
          </button>
        </div>
      </div>
    </div>
    </>
  )
}