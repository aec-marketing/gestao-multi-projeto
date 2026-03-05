'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Resource, Task } from '@/types/database.types'
import { Allocation, PRIORITY_CONFIG } from '@/types/allocation.types'
import { formatDateBR } from '@/utils/date.utils'
import { formatMinutes } from '@/utils/time.utils'
import { calculateResourceCost, formatCurrency } from '@/utils/cost.utils'
import { showErrorAlert, showSuccessAlert, logError, ErrorContext } from '@/utils/errorHandler'
import { dispatchToast } from '@/components/ui/ToastProvider'
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

  // Conflitos de alocação global (entre projetos)
  const [allocationConflicts, setAllocationConflicts] = useState<ResourceConflict[]>([])
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false)
  // 'block' = existente é exclusivo (bloqueia), 'warn' = existente é compartilhado (avisa), 'none' = sem conflito
  const [conflictLevel, setConflictLevel] = useState<'block' | 'warn' | 'none'>('none')

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
  // Ref para evitar que o useEffect de conflitos abra o Planner quando openPlannerForEdit já o fez
  const plannerOpenedByEditRef = useRef(false)
  const [existingFragmentsForEdit, setExistingFragmentsForEdit] = useState<AllocationFragment[]>([])
  // Fragmentos confirmados no Planner — aguardando confirmação final no modal principal
  const [plannedFragments, setPlannedFragments] = useState<AllocationFragment[] | null>(null)
  // Substituição parcial: dias com conflito (date → nome do recurso bloqueante) e substitutos disponíveis
  const [conflictedDays, setConflictedDays] = useState<Record<string, string>>({})
  const [substituteResources, setSubstituteResources] = useState<Array<{id: string; name: string; hierarchy: string; role: string | null; daily_capacity_minutes: number; hourly_rate: number}>>([])

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
          setOvertimeMultiplier(allocation.overtime_multiplier || 1.5)
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
   * Detecta conflitos antes de abrir para garantir que isConflicted/substitutos sejam carregados
   */
  async function openPlannerForEdit(resourceId: string) {
    const selectedResource = allResources.find(r => r.id === resourceId)
    if (!selectedResource || !task.start_date) return

    // Fragmentos do recurso principal
    const mainFragments = existingAllocations
      .filter(a => a.resource_id === resourceId)
      .sort((a, b) => new Date(a.start_date || '').getTime() - new Date(b.start_date || '').getTime())
      .map(a => ({
        start_date: a.start_date || '',
        end_date: a.end_date || '',
        allocated_minutes: a.allocated_minutes ?? 0,
        overtime_minutes: a.overtime_minutes || 0,
        overtime_multiplier: a.overtime_multiplier || 1.0,
      }))

    // Fragmentos de substitutos: alocações de outros recursos nesta tarefa
    const substituteFragments = existingAllocations
      .filter(a => a.resource_id !== resourceId)
      .sort((a, b) => new Date(a.start_date || '').getTime() - new Date(b.start_date || '').getTime())
      .map(a => ({
        start_date: a.start_date || '',
        end_date: a.end_date || '',
        allocated_minutes: a.allocated_minutes ?? 0,
        overtime_minutes: a.overtime_minutes || 0,
        overtime_multiplier: a.overtime_multiplier || 1.0,
        resource_id: a.resource_id,
        resource_name: allResources.find(r => r.id === a.resource_id)?.name,
      }))

    const allFragments = [...mainFragments, ...substituteFragments].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    )

    // Detectar conflitos para marcar dias corretamente no Planner
    let editConflictedDays: Record<string, string> = {}
    let editSubstituteResources: typeof substituteResources = []

    try {
      const { checkAllocationConflicts } = await import('@/lib/resource-service')
      const foundConflicts = await checkAllocationConflicts(
        resourceId,
        task.start_date,
        task.end_date || task.start_date
      )

      if (foundConflicts.length > 0) {
        const { data: conflictingAllocs } = await supabase
          .from('allocations')
          .select('start_date, end_date, priority, task:tasks(name)')
          .eq('resource_id', resourceId)
          .eq('priority', 'alta')

        const taskStart = new Date(task.start_date + 'T00:00:00')
        const taskEnd = new Date((task.end_date || task.start_date) + 'T00:00:00')

        if (conflictingAllocs) {
          for (const alloc of conflictingAllocs) {
            if (!alloc.start_date || !alloc.end_date) continue
            const aStart = new Date(alloc.start_date + 'T00:00:00')
            const aEnd = new Date(alloc.end_date + 'T00:00:00')
            const overlapStart = aStart > taskStart ? aStart : taskStart
            const overlapEnd = aEnd < taskEnd ? aEnd : taskEnd
            const d = new Date(overlapStart)
            while (d <= overlapEnd) {
              editConflictedDays[d.toISOString().split('T')[0]] = (alloc.task as any)?.name || 'exclusivo'
              d.setDate(d.getDate() + 1)
            }
          }
        }

        // Buscar substitutos da mesma equipe
        if (Object.keys(editConflictedDays).length > 0) {
          const leaderId = selectedResource.hierarchy === 'lider' ? selectedResource.id : selectedResource.leader_id
          if (leaderId) {
            const { data: teammates } = await supabase
              .from('resources')
              .select('*')
              .eq('leader_id', leaderId)
              .eq('is_active', true)
              .neq('id', resourceId)
            editSubstituteResources = teammates || []
          }
        }
      }
    } catch {
      // Ignorar erros na detecção — abrir Planner mesmo assim
    }

    plannerOpenedByEditRef.current = true
    setConflictedDays(editConflictedDays)
    setSubstituteResources(editSubstituteResources)
    setSelectedResourceId(resourceId)
    setSelectedResourceForModal(selectedResource)
    setExistingFragmentsForEdit(allFragments)
    setPendingAllocation({
      resourceId,
      priority: existingAllocations.find(a => a.resource_id === resourceId)?.priority as 'alta' | 'media' | 'baixa' || 'media',
      allocationType: 'full',
      allocatedMinutes: task.duration_minutes || 0
    })
    setShowPlanner(true)
  }

  // Verificação de conflitos globais + detecção de overflow (em sequência)
  // O Planner só é aberto APÓS confirmar que não há conflito blocante
  useEffect(() => {
    if (!selectedResourceId || !task.start_date) {
      setAllocationConflicts([])
      setConflictLevel('none')
      return
    }

    const selectedResource = allResources.find(r => r.id === selectedResourceId)
    if (!selectedResource) return

    const run = async () => {
      // 1. Verificar conflitos globais primeiro
      setIsCheckingConflicts(true)
      let foundConflicts: import('@/lib/resource-service').ResourceConflict[] = []
      let level: 'block' | 'warn' | 'none' = 'none'

      try {
        const { checkAllocationConflicts } = await import('@/lib/resource-service')
        foundConflicts = await checkAllocationConflicts(
          selectedResourceId,
          task.start_date!,
          task.end_date || task.start_date!
        )
        setAllocationConflicts(foundConflicts)

        if (foundConflicts.length === 0) {
          level = 'none'
        } else {
          const hasExclusive = foundConflicts.some(c => c.existingPriority === 'alta')
          level = hasExclusive ? 'block' : 'warn'
        }
        // Nível provisório — pode ser rebaixado para 'warn' se o conflito for apenas parcial
        setConflictLevel(level)
      } catch {
        setAllocationConflicts([])
        setConflictLevel('none')
      } finally {
        setIsCheckingConflicts(false)
      }

      // 2. Se há conflito (block ou warn): calcular quais dias específicos estão bloqueados
      let localConflictedDays: Record<string, string> = {}
      if ((level === 'block' || level === 'warn') && foundConflicts.length > 0 && task.start_date) {
        // Buscar alocações exclusivas reais do recurso neste período para obter datas exatas
        const { data: conflictingAllocs } = await supabase
          .from('allocations')
          .select('start_date, end_date, priority, task:tasks(name)')
          .eq('resource_id', selectedResourceId)
          .eq('priority', 'alta')

        const blockedExact: Record<string, string> = {}
        const taskEndDate = task.end_date || task.start_date

        if (conflictingAllocs) {
          const taskStart = new Date(task.start_date + 'T00:00:00')
          const taskEnd = new Date(taskEndDate + 'T00:00:00')
          for (const alloc of conflictingAllocs) {
            if (!alloc.start_date || !alloc.end_date) continue
            const aStart = new Date(alloc.start_date + 'T00:00:00')
            const aEnd = new Date(alloc.end_date + 'T00:00:00')
            const overlapStart = aStart > taskStart ? aStart : taskStart
            const overlapEnd = aEnd < taskEnd ? aEnd : taskEnd
            const d = new Date(overlapStart)
            while (d <= overlapEnd) {
              const ds = d.toISOString().split('T')[0]
              blockedExact[ds] = (alloc.task as any)?.name || 'exclusivo'
              d.setDate(d.getDate() + 1)
            }
          }
        }

        // Contar quantos dias úteis a tarefa tem no total
        const countBusinessDays = (start: string, end: string) => {
          let count = 0
          const cur = new Date(start + 'T00:00:00')
          const endD = new Date(end + 'T00:00:00')
          while (cur <= endD) {
            const dow = cur.getDay()
            if (dow !== 0 && dow !== 6) count++
            cur.setDate(cur.getDate() + 1)
          }
          return count
        }
        const totalTaskDays = countBusinessDays(task.start_date, task.end_date || task.start_date)
        const blockedCount = Object.keys(blockedExact).length

        if (blockedCount > 0 && blockedCount < totalTaskDays) {
          // Conflito PARCIAL: nem todos os dias estão bloqueados — rebaixar para 'warn' e mostrar Planner
          level = 'warn'
          setConflictLevel('warn')
          setConflictedDays(blockedExact)
          localConflictedDays = blockedExact
        } else if (blockedCount >= totalTaskDays) {
          // Todos os dias estão bloqueados — bloquear totalmente
          setConflictedDays({})
        } else {
          // Nenhum dia exato encontrado (pode ser só o start_date do conflito sem range completo)
          setConflictedDays({})
        }

        // Buscar substitutos: recursos da mesma equipe (mesmo leader_id) disponíveis
        if (Object.keys(blockedExact).length > 0 && blockedExact && (selectedResource.leader_id || selectedResource.hierarchy === 'lider')) {
          const leaderId = selectedResource.hierarchy === 'lider' ? selectedResource.id : selectedResource.leader_id
          if (leaderId) {
            const { data: teammates } = await supabase
              .from('resources')
              .select('*')
              .eq('leader_id', leaderId)
              .eq('is_active', true)
              .neq('id', selectedResourceId)
            setSubstituteResources(teammates || [])
          } else {
            setSubstituteResources([])
          }
        } else {
          setSubstituteResources([])
        }
      } else {
        setConflictedDays({})
        setSubstituteResources([])
      }

      // 3. Se ainda é 'block' (todos os dias bloqueados), não abrir Planner
      if (level === 'block') return

      // 4. Calcular overflow/plano multi-dia e abrir Planner se necessário
      const minutesToAllocate = allocationType === 'partial' ? allocatedMinutes : task.duration_minutes || 0

      const existingAllocationsByDate: Record<string, number> = {}
      const allResourceAllocations = allAllocations.filter(a => a.resource_id === selectedResourceId)

      for (const alloc of allResourceAllocations) {
        const dateKey = alloc.start_date
        if (!dateKey) continue
        if (!existingAllocationsByDate[dateKey]) existingAllocationsByDate[dateKey] = 0

        if (alloc.allocated_minutes !== null && alloc.allocated_minutes !== undefined) {
          existingAllocationsByDate[dateKey] += alloc.allocated_minutes
        } else {
          const { data: taskData } = await supabase
            .from('tasks')
            .select('duration_minutes')
            .eq('id', alloc.task_id)
            .single()
          existingAllocationsByDate[dateKey] += taskData?.duration_minutes || 0
        }
      }

      const plan = calculateMultiDayAllocationPlan(
        minutesToAllocate,
        selectedResource,
        task.start_date!,
        existingAllocationsByDate,
        false
      )

      // Se o Planner já foi aberto por openPlannerForEdit, não abrir novamente
      if (plannerOpenedByEditRef.current) {
        plannerOpenedByEditRef.current = false
        return
      }

      // Em modo de edição (allocationId), só atualizar conflictedDays/substituteResources
      if (allocationId) return

      // Abrir Planner se: multi-dia, fim de semana, overflow, ou há dias conflitados para substituição
      const hasConflictedDaysNow = level === 'warn' && Object.keys(localConflictedDays).length > 0

      if (plan.days.length > 1 || plan.requiresWeekendDecision || plan.requiresUserDecision || hasConflictedDaysNow) {
        setPendingAllocation({
          resourceId: selectedResourceId,
          priority: priority,
          allocationType: allocationType,
          allocatedMinutes: allocatedMinutes
        })
        setSelectedResourceForModal(selectedResource)
        setMultiDayPlan(plan)
        setShowPlanner(true)
      }
    }

    run()
  }, [selectedResourceId, allocationType, allocatedMinutes, allocationId, allResources, allAllocations, task, priority])

  async function handleAllocate() {
    if (!selectedResourceId) {
      dispatchToast('Selecione uma pessoa', 'info')
      return
    }

    // Check for task dates
    if (!task.start_date || !task.end_date) {
      dispatchToast('Esta tarefa não possui datas definidas', 'info')
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
          setShowConflictWarning(true)
          setAllowOverride(false)  // Não permitir override de eventos pessoais
          setIsSaving(false)
          return
        }

        // Verificação de conflitos de alocação baseada em dedicação (priority)
        // Se há conflitos de sobreposição de alocação:
        if (allocationConflicts.length > 0) {
          // Se alguma alocação existente é 'exclusiva' (alta) → bloquear
          if (conflictLevel === 'block') {
            setConflicts(allocationConflicts)
            setShowConflictWarning(true)
            setAllowOverride(false)
            setIsSaving(false)
            return
          }

          // Se a alocação que estamos criando é 'exclusiva' (alta) → bloquear também
          if (priority === 'alta') {
            setConflicts(allocationConflicts)
            setShowConflictWarning(true)
            setAllowOverride(true) // Permitir override mudando para compartilhado
            setIsSaving(false)
            return
          }

          // Se conflictLevel === 'warn' e a nova alocação não é exclusiva → só avisa, não bloqueia
          // (continua para o INSERT)
        }
      }

      // Salvar — com fragmentos do Planner ou INSERT simples
      if (plannedFragments && plannedFragments.length > 0) {
        // Fluxo com Planner: salvar todos os fragmentos usando a dedicação escolhida no modal
        await savePlannerFragments(plannedFragments, selectedResourceId, priority)
      } else if (allocationId) {
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
        if (updateError) throw updateError
      } else {
        // INSERT simples (tarefa de 1 dia, sem Planner)
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
        if (insertError) throw insertError
      }

      // Atualizar custo real da tarefa
      await updateTaskActualCost(task.id)

      showSuccessAlert(allocationId ? 'Alocação atualizada com sucesso!' : 'Recurso alocado com sucesso!')

      // Reset form
      setSelectedResourceId('')
      setPriority('media')
      setConflicts([])
      setShowConflictWarning(false)
      setPlannedFragments(null)
      setPendingAllocation(null)
      setSelectedResourceForModal(null)

      // Refresh global allocations
      await refreshAllocations()
      onSuccess()
    } catch (error: any) {
      if (error.code === '23505') {
        dispatchToast('Esta pessoa já está alocada nesta tarefa', 'info')
      } else {
        logError(error, 'handleAllocate')
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
      switch (option.type) {
        case 'push_date':
          // Empurrar para próximo dia (sem hora extra)
          // IMPORTANTE: Criar 2 alocações - uma no dia atual (capacidade disponível) + uma no próximo dia (resto)
          if (!overflowResult) {
            throw new Error('overflowResult não encontrado para push_date')
          }

          // Se há capacidade disponível no dia atual, criar alocação para usar essa capacidade
          if (overflowResult.minutesAvailable > 0) {
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
              throw firstAllocError
            }
          }

          // Segunda alocação: resto no próximo dia
          allocationData.start_date = option.newEndDate
          allocationData.end_date = option.newEndDate
          allocationData.allocated_minutes = overflowResult.minutesOverflow

          // IMPORTANTE: Atualizar a data de fim da tarefa também!
          const { error: taskUpdateError } = await supabase
            .from('tasks')
            .update({ end_date: option.newEndDate })
            .eq('id', task.id)

          if (taskUpdateError) {
            throw taskUpdateError
          }
          break

        case 'overtime_weekday':
          // Usar hora extra em dia útil (1.5×) - COM LIMITE CLT DE 2H
          const MAX_OVERTIME_WEEKDAY_MINUTES = 120
          const totalOverflow = overflowResult.minutesOverflow
          const overtimeToday = Math.min(totalOverflow, MAX_OVERTIME_WEEKDAY_MINUTES)
          const exceededOvertime = totalOverflow - overtimeToday

          // Primeira alocação: capacidade disponível hoje + hora extra (max 2h)
          allocationData.allocated_minutes = overflowResult.minutesAvailable
          allocationData.overtime_minutes = overtimeToday
          allocationData.overtime_multiplier = 1.5

          // Se há excedente além das 2h, criar segunda alocação no próximo dia
          if (exceededOvertime > 0) {
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

          break

        case 'overtime_weekend':
          // Trabalhar no fim de semana (2.0×)
          allocationData.overtime_minutes = option.overtimeMinutes
          allocationData.overtime_multiplier = option.multiplier

          if (option.newEndDate) {
            allocationData.start_date = option.newEndDate
            allocationData.end_date = option.newEndDate

            // IMPORTANTE: Atualizar a data de fim da tarefa para o fim de semana
            const { error: taskUpdateError2 } = await supabase
              .from('tasks')
              .update({ end_date: option.newEndDate })
              .eq('id', task.id)

            if (taskUpdateError2) {
              throw taskUpdateError2
            }
          }
          break
      }

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

        // Se há segunda alocação (excedente CLT), criar agora
        if (secondAllocationData) {
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
        }
      } else {
        // Para push_date, inserir apenas a segunda alocação (primeira já foi criada no switch)
        const { error } = await supabase
          .from('allocations')
          .insert(allocationData)

        if (error) throw error
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
        dispatchToast('Esta pessoa já está alocada nesta tarefa', 'info')
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
    if (!pendingAllocation || !multiDayPlan || !selectedResourceForModal) {
      return
    }

    setShowMultiDayModal(false)
    setIsSaving(true)

    try {
      const { resourceId, priority } = pendingAllocation

      // 🌊 ONDA 4.4: Mapear decisões de overflow E fim de semana
      const overflowDecisionsMap = new Map(decisions.map(d => [d.date, d]))
      const weekendDecisionsMap = new Map(weekendDecisions.map(d => [d.date, d]))

      // Para cada dia do plano, criar alocação
      const allocationsToCreate: any[] = []
      let remainingMinutes = pendingAllocation.allocatedMinutes
      const dailyCapacity = selectedResourceForModal.daily_capacity_minutes || 540

      // 🌊 ONDA 4.4: Processar CRONOLOGICAMENTE - incluindo fins de semana
      let currentDate = new Date(task.start_date + 'T00:00:00')
      const maxDays = 60 // Segurança

      for (let dayIndex = 0; dayIndex < maxDays && remainingMinutes > 0; dayIndex++) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const dayOfWeek = currentDate.getDay() // 0 = domingo, 6 = sábado
        const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6

        let normalMinutes = 0
        let overtimeMinutes = 0
        let overtimeMultiplier = 1.0

        // 🌊 ONDA 4.4: Verificar se é FIM DE SEMANA
        if (isWeekendDay) {
          const weekendDecision = weekendDecisionsMap.get(dateStr)

          if (weekendDecision?.useWeekend) {
            // Usuário escolheu TRABALHAR no fim de semana
            normalMinutes = Math.min(remainingMinutes, weekendDecision.minutesToWork)
            overtimeMinutes = normalMinutes // TODO FIM DE SEMANA É TUDO OVERTIME
            normalMinutes = 0 // Zerar normal pois tudo é overtime
            overtimeMultiplier = 2.0 // Fim de semana sempre 2.0×
            remainingMinutes -= overtimeMinutes
          } else {
            // Usuário escolheu PULAR fim de semana
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
    // Armazenar decisões
    setWeekendDecisions(decisions)
    setShowWeekendModal(false)

    // Agora abrir modal de overflow (se necessário)
    if (multiDayPlan?.requiresUserDecision) {
      setShowMultiDayModal(true)
    } else {
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
   * 🌊 ONDA 5: Confirmar plano no Planner — guarda fragmentos e volta para o modal principal
   * O salvamento final só acontece quando o usuário clicar em "Alocar Pessoa"
   */
  function handlePlannerConfirm(fragments: AllocationFragment[]) {
    setPlannedFragments(fragments)
    setShowPlanner(false)
    // Não limpar selectedResourceForModal nem pendingAllocation — ainda serão usados no handleAllocate
  }

  /**
   * 🌊 ONDA 5: Salvar fragmentos no banco (chamado por handleAllocate quando plannedFragments existe)
   */
  async function savePlannerFragments(
    fragments: AllocationFragment[],
    resourceId: string,
    dedicacao: 'alta' | 'media' | 'baixa'
  ) {
    // MODO DE EDIÇÃO: deletar alocações existentes deste recurso nesta tarefa
    const existingResourceAllocations = existingAllocations.filter(a => a.resource_id === resourceId)
    if (existingResourceAllocations.length > 0) {
      const { error: deleteError } = await supabase
        .from('allocations')
        .delete()
        .eq('task_id', task.id)
        .eq('resource_id', resourceId)
      if (deleteError) throw deleteError
    }

    // Criar alocações para cada fragmento
    // Fragmentos com resource_id próprio são de substitutos — usar esse resource_id
    const allocationsToCreate = fragments.map(fragment => ({
      resource_id: fragment.resource_id || resourceId,  // Substituto ou recurso principal
      task_id: task.id,
      priority: dedicacao,
      start_date: fragment.start_date,
      end_date: fragment.end_date,
      allocated_minutes: fragment.allocated_minutes,
      // Hora extra: usa do fragmento se já veio do Planner, senão aplica a configuração do modal (só para o recurso principal)
      overtime_minutes: fragment.overtime_minutes > 0
        ? fragment.overtime_minutes
        : (!fragment.resource_id && hasOvertime ? overtimeMinutes : 0),
      overtime_multiplier: fragment.overtime_minutes > 0
        ? fragment.overtime_multiplier
        : (!fragment.resource_id && hasOvertime ? overtimeMultiplier : 1.0)
    }))

    const { error: insertError } = await supabase
      .from('allocations')
      .insert(allocationsToCreate)
    if (insertError) throw insertError

    // Atualizar end_date da tarefa com o último fragmento
    const sortedFragments = [...fragments].sort((a, b) =>
      new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
    )
    if (sortedFragments.length > 0) {
      await supabase
        .from('tasks')
        .update({ end_date: sortedFragments[0].end_date })
        .eq('id', task.id)
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
    setPlannedFragments(null)
    setSelectedResourceId('')
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
          conflictedDays={conflictedDays}
          substituteResources={substituteResources}
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
                        (a, b) => new Date(a.start_date ?? '').getTime() - new Date(b.start_date ?? '').getTime()
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
                          onChange={(e) => { setSelectedResourceId(e.target.value); setPlannedFragments(null) }}
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
                                    onChange={(e) => { setSelectedResourceId(e.target.value); setPlannedFragments(null) }}
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

              {/* Aviso de conflito de alocação global — aparece ao selecionar recurso */}
              {selectedResourceId && allocationConflicts.length > 0 && (
                <div className={`mt-4 p-4 rounded-lg border-2 ${
                  conflictLevel === 'block'
                    ? 'bg-red-50 border-red-300'
                    : 'bg-yellow-50 border-yellow-300'
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{conflictLevel === 'block' ? '🔒' : '⚡'}</span>
                    <div className="flex-1">
                      <h5 className={`font-bold mb-1 ${conflictLevel === 'block' ? 'text-red-900' : 'text-yellow-900'}`}>
                        {conflictLevel === 'block'
                          ? 'Recurso exclusivo em outro projeto'
                          : 'Recurso já alocado neste período'
                        }
                      </h5>
                      <p className={`text-sm mb-2 ${conflictLevel === 'block' ? 'text-red-700' : 'text-yellow-800'}`}>
                        {conflictLevel === 'block'
                          ? 'Este recurso está marcado como Exclusivo em outra(s) tarefa(s) sobrepostas. Escolha outro recurso ou altere a dedicação da alocação existente.'
                          : 'Este recurso possui alocações sobrepostas. Defina a Dedicação abaixo para controlar como o conflito é tratado.'
                        }
                      </p>
                      <div className="space-y-1">
                        {allocationConflicts.map((c, i) => (
                          <div key={i} className={`text-xs px-2 py-1 rounded border ${
                            conflictLevel === 'block' ? 'bg-red-100 border-red-200 text-red-800' : 'bg-yellow-100 border-yellow-200 text-yellow-800'
                          }`}>
                            <span className="font-medium">
                              {PRIORITY_CONFIG[c.existingPriority || 'media'].icon} {PRIORITY_CONFIG[c.existingPriority || 'media'].label}
                            </span>
                            {' — '}{c.message}
                          </div>
                        ))}
                      </div>

                      {/* Botão para planejar substituição quando há dias conflitados parcialmente */}
                      {conflictLevel === 'warn' && Object.keys(conflictedDays).length > 0 && !isCheckingConflicts && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                          <p className="text-xs text-amber-900 mb-2 font-medium">
                            📅 {Object.keys(conflictedDays).length} dia(s) com conflito detectado(s).
                            Você pode alocar este recurso nos dias livres e escolher um substituto para os dias bloqueados.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const selectedResource = allResources.find(r => r.id === selectedResourceId)
                              if (!selectedResource) return
                              setPendingAllocation({
                                resourceId: selectedResourceId,
                                priority: priority,
                                allocationType: allocationType,
                                allocatedMinutes: allocationType === 'partial' ? allocatedMinutes : (task.duration_minutes || 0)
                              })
                              setSelectedResourceForModal(selectedResource)
                              setShowPlanner(true)
                            }}
                            className="w-full px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                          >
                            🗓️ Planejar distribuição por dias (com substituição)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Loading de verificação de conflitos */}
              {selectedResourceId && isCheckingConflicts && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  Verificando disponibilidade em todos os projetos...
                </div>
              )}

              {/* Sem conflitos confirmado */}
              {selectedResourceId && !isCheckingConflicts && allocationConflicts.length === 0 && task.start_date && task.end_date && !allocationId && (
                <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span>✅</span>
                  <span>Recurso disponível neste período (sem conflitos em outros projetos)</span>
                </div>
              )}

              {/* Seleção de Dedicação (renomeado de Prioridade) */}
              {selectedResourceId && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dedicação deste recurso
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Define se o recurso pode ser alocado em outras tarefas com datas sobrepostas
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['alta', 'media', 'baixa'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          priority === p
                            ? `${PRIORITY_CONFIG[p].color} border-current`
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {PRIORITY_CONFIG[p].icon} {PRIORITY_CONFIG[p].label}
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
                      onClick={() => {
                        setAllocationType('partial')
                        // Se há dias conflitados, abrir o Planner automaticamente ao selecionar "Parcial"
                        if (conflictLevel === 'warn' && Object.keys(conflictedDays).length > 0) {
                          const selectedResource = allResources.find(r => r.id === selectedResourceId)
                          if (selectedResource) {
                            setPendingAllocation({
                              resourceId: selectedResourceId,
                              priority: priority,
                              allocationType: 'partial',
                              allocatedMinutes: allocatedMinutes
                            })
                            setSelectedResourceForModal(selectedResource)
                            setShowPlanner(true)
                          }
                        }
                      }}
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
                        {conflictLevel === 'warn' && Object.keys(conflictedDays).length > 0 && (
                          <span className="ml-1 text-xs text-amber-600 font-normal">(abre planejador)</span>
                        )}
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

              {/* Resumo do plano confirmado no Planner */}
              {plannedFragments && plannedFragments.length > 0 ? (
                <div className="mt-4 p-3 bg-green-50 border-2 border-green-300 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-green-900">✅ Plano confirmado ({plannedFragments.length} fragmento{plannedFragments.length > 1 ? 's' : ''})</span>
                    <button
                      type="button"
                      onClick={() => setShowPlanner(true)}
                      className="text-xs text-green-700 underline hover:text-green-900"
                    >
                      Editar plano
                    </button>
                  </div>
                  <div className="space-y-1">
                    {plannedFragments.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-green-800">
                        <span className="text-xs font-mono bg-green-100 px-1.5 py-0.5 rounded">
                          {f.start_date === f.end_date ? f.start_date : `${f.start_date} → ${f.end_date}`}
                        </span>
                        <span className="text-xs">{formatMinutes(f.allocated_minutes)}</span>
                        {f.overtime_minutes > 0 && (
                          <span className="text-xs text-orange-700">+ {formatMinutes(f.overtime_minutes)} extra</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : task.start_date && task.end_date && selectedResourceId && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  ℹ️ Esta alocação usará as datas da tarefa:
                  <div className="mt-1">
                    <strong>Início:</strong> {formatDateBR(task.start_date)} •
                    <strong> Fim:</strong> {formatDateBR(task.end_date)}
                  </div>
                </div>
              )}

              {/* ✅ Conflict Warning — eventos pessoais bloqueantes ou alocação exclusiva */}
              {showConflictWarning && conflicts.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-red-600 text-xl">🚫</span>
                    <div className="flex-1">
                      <h5 className="font-bold text-red-900 mb-1">
                        {allowOverride
                          ? 'Conflito de Dedicação — Escolha outro nível'
                          : conflicts[0]?.type === 'personal_event_block'
                          ? 'Recurso indisponível — Evento pessoal bloqueante'
                          : 'Recurso Exclusivo em outro projeto'
                        }
                      </h5>
                      <p className="text-sm text-red-800 mb-3">
                        {allowOverride
                          ? 'Você está tentando alocar como Exclusivo, mas este recurso já possui alocações sobrepostas. Mude a Dedicação para "Compartilhado" ou "Flexível" para prosseguir.'
                          : conflicts[0]?.type === 'personal_event_block'
                          ? 'O recurso possui um evento pessoal que bloqueia trabalho neste período:'
                          : 'Este recurso está marcado como Exclusivo em outra(s) tarefa(s) sobrepostas. Não é possível alocar.'
                        }
                      </p>
                      <div className="space-y-2">
                        {conflicts.map((conflict, idx) => (
                          <div key={idx} className="bg-white p-2 rounded border border-red-200 text-sm text-red-900">
                            <div className="font-medium">
                              {conflict.type === 'allocation_overlap' && (
                                <span>
                                  {PRIORITY_CONFIG[conflict.existingPriority || 'media'].icon}{' '}
                                  {PRIORITY_CONFIG[conflict.existingPriority || 'media'].label} em outra tarefa
                                </span>
                              )}
                              {conflict.type === 'personal_event_block' && '🚫 Evento pessoal bloqueante'}
                            </div>
                            <div className="text-red-700 mt-1">{conflict.message}</div>
                          </div>
                        ))}
                      </div>

                      {/* Override: mudar dedicação para Compartilhado/Flexível */}
                      {allowOverride && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                          <div className="text-sm text-yellow-900 font-medium mb-2">
                            💡 Mude a Dedicação para continuar
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => { setPriority('media'); setShowConflictWarning(false); setConflicts([]); setAllowOverride(false) }}
                              className="p-2 rounded-lg border-2 border-yellow-400 bg-yellow-100 text-yellow-900 text-xs font-medium hover:bg-yellow-200 transition-colors"
                            >
                              ⚡ Compartilhado<br/>
                              <span className="font-normal opacity-80">Permite sobreposição com aviso</span>
                            </button>
                            <button
                              onClick={() => { setPriority('baixa'); setShowConflictWarning(false); setConflicts([]); setAllowOverride(false) }}
                              className="p-2 rounded-lg border-2 border-blue-300 bg-blue-50 text-blue-900 text-xs font-medium hover:bg-blue-100 transition-colors"
                            >
                              🔓 Flexível<br/>
                              <span className="font-normal opacity-80">Sem restrições</span>
                            </button>
                          </div>
                          <button
                            onClick={() => { setShowConflictWarning(false); setConflicts([]); setAllowOverride(false); setSelectedResourceId('') }}
                            className="mt-2 w-full px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition-colors"
                          >
                            Escolher outro recurso
                          </button>
                        </div>
                      )}

                      {/* Apenas fechar para conflitos não-overridáveis */}
                      {!allowOverride && (
                        <button
                          onClick={() => {
                            setShowConflictWarning(false)
                            setConflicts([])
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