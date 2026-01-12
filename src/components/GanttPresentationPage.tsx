'use client'

import React, { useEffect, useState } from 'react'
import { Task, Project } from '@/types/database.types'
import { parseLocalDate } from '@/utils/date.utils'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface GanttPresentationPageProps {
  projectId: string
}

interface TaskWithDates {
  id: string
  name: string
  start_date: Date
  end_date: Date
  duration_days: number
  parent_id: string | null
  type?: string
  wbs_code?: string
  outline_level?: number
}

export default function GanttPresentationPage({ projectId }: GanttPresentationPageProps) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Carregar dados do projeto
  useEffect(() => {
    async function loadData() {
      try {
        // Buscar projeto
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single()

        if (projectError) throw projectError

        // Buscar tarefas
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order')

        if (tasksError) throw tasksError

        setProject(projectData)
        setTasks(tasksData || [])
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        alert('Erro ao carregar dados do projeto')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [projectId])

  // Calcular datas das tarefas mantendo hierarquia
  const tasksWithDates: TaskWithDates[] = React.useMemo(() => {
    if (!project?.start_date) return []

    const projectStart = parseLocalDate(project.start_date)
    if (!projectStart) return []

    const tasksMap = new Map(
      tasks
        .filter(t => t.start_date && t.end_date)
        .map(task => {
          const start = parseLocalDate(task.start_date!)!
          const end = parseLocalDate(task.end_date!)!
          const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)

          return [task.id, {
            id: task.id,
            name: task.name,
            start_date: start,
            end_date: end,
            duration_days: duration,
            parent_id: task.parent_id,
            type: task.type,
            wbs_code: task.wbs_code,
            outline_level: task.outline_level
          }]
        })
    )

    // Ordenar mantendo hierarquia: pai seguido de seus filhos
    const result: TaskWithDates[] = []
    const processed = new Set<string>()

    function addTaskAndChildren(taskId: string) {
      if (processed.has(taskId)) return

      const task = tasksMap.get(taskId)
      if (!task) return

      processed.add(taskId)
      result.push(task)

      // Adicionar filhos ordenados por data
      const children = Array.from(tasksMap.values())
        .filter(t => t.parent_id === taskId)
        .sort((a, b) => {
          const startCompare = a.start_date.getTime() - b.start_date.getTime()
          if (startCompare !== 0) return startCompare
          return a.end_date.getTime() - b.end_date.getTime()
        })

      children.forEach(child => addTaskAndChildren(child.id))
    }

    // Função para obter a data de início real (considerando filhos)
    function getEffectiveStartDate(task: TaskWithDates): Date {
      const allChildren = Array.from(tasksMap.values()).filter(t => t.parent_id === task.id)
      if (allChildren.length === 0) return task.start_date

      // Recursivamente obter datas dos filhos
      const childrenDates = allChildren.map(child => getEffectiveStartDate(child))
      const earliestChildStart = new Date(Math.min(...childrenDates.map(d => d.getTime())))

      // Retornar a menor data entre o pai e seus filhos
      return task.start_date < earliestChildStart ? task.start_date : earliestChildStart
    }

    // Começar pelas raízes (tarefas sem pai) ordenadas pela data efetiva (considerando filhos)
    const roots = Array.from(tasksMap.values())
      .filter(t => !t.parent_id)
      .sort((a, b) => {
        const aEffectiveStart = getEffectiveStartDate(a)
        const bEffectiveStart = getEffectiveStartDate(b)
        const startCompare = aEffectiveStart.getTime() - bEffectiveStart.getTime()
        if (startCompare !== 0) return startCompare
        return a.end_date.getTime() - b.end_date.getTime()
      })

    roots.forEach(root => addTaskAndChildren(root.id))

    return result
  }, [tasks, project])

  // Calcular range de datas do projeto
  const dateRange = React.useMemo(() => {
    if (tasksWithDates.length === 0) return { start: new Date(), end: new Date(), days: 0 }

    const allDates = tasksWithDates.flatMap(t => [t.start_date, t.end_date])
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
    const days = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    return { start: minDate, end: maxDate, days }
  }, [tasksWithDates])

  // Função para calcular posição horizontal da tarefa
  const getTaskPosition = (task: TaskWithDates) => {
    const startOffset = Math.ceil((task.start_date.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    const width = task.duration_days
    const totalDays = dateRange.days

    return {
      left: (startOffset / totalDays) * 100,
      width: (width / totalDays) * 100
    }
  }

  // Calcular número de páginas necessárias
  // A4 tem 297mm de altura
  // - 10mm padding top + 10mm padding bottom = 20mm
  // - Header (título + datas): ~12mm
  // - Footer: ~4mm
  // - Timeline: ~15mm
  // Total disponível para tarefas: 297 - 20 - 12 - 4 - 15 = 246mm
  // Cada tarefa tem 9mm de altura
  // 246mm / 9mm = ~27 tarefas por página
  // Usando 22 para margem de segurança
  const tasksPerPage = 22
  const totalPages = Math.ceil(tasksWithDates.length / tasksPerPage)

  // Função para imprimir
  const handlePrint = () => {
    window.print()
  }

  // Função para voltar
  const handleBack = () => {
    router.back()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando visualização de apresentação...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Projeto não encontrado</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - visível apenas na tela */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 print:hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">📊 Visualização para Apresentação</h1>
              <p className="text-purple-100">
                {project.name} • {tasksWithDates.length} tarefas • {dateRange.days} dias • {totalPages} página(s)
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium shadow-lg"
              >
                🖨️ Imprimir / PDF
              </button>
              <button
                onClick={handleBack}
                className="px-6 py-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors font-medium"
              >
                ← Voltar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Visualização das páginas */}
      <div className="max-w-[210mm] mx-auto py-8 print:p-0">
        {Array.from({ length: totalPages }, (_, pageIndex) => {
          const startIdx = pageIndex * tasksPerPage
          const endIdx = Math.min(startIdx + tasksPerPage, tasksWithDates.length)
          const pageTasks = tasksWithDates.slice(startIdx, endIdx)

          return (
            <div
              key={pageIndex}
              className="bg-white mb-8 shadow-xl print:shadow-none print:mb-0 flex flex-col"
              style={{
                width: '210mm',
                height: '297mm',
                padding: '10mm',
                pageBreakAfter: pageIndex < totalPages - 1 ? 'always' : 'auto',
                pageBreakInside: 'avoid',
                boxSizing: 'border-box'
              }}
            >
              {/* Header da página */}
              <div className="mb-3 pb-2 border-b-2 border-gray-300 flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <div className="flex justify-between items-center mt-1 text-xs text-gray-600">
                  <span>
                    {dateRange.start.toLocaleDateString('pt-BR')} - {dateRange.end.toLocaleDateString('pt-BR')}
                  </span>
                  <span>
                    Página {pageIndex + 1} de {totalPages}
                  </span>
                </div>
              </div>

              {/* Gantt compacto - área flexível que cresce */}
              <div className="space-y-0.5 flex-1 overflow-hidden">
                {pageTasks.map((task, idx) => {
                  const pos = getTaskPosition(task)
                  const globalIndex = startIdx + idx

                  const isParent = tasks.some(t => t.parent_id === task.id)
                  const isChild = !!task.parent_id
                  const indentLevel = task.outline_level || 0

                  return (
                    <div
                      key={task.id}
                      className={`flex items-center ${
                        isParent ? 'bg-blue-50 border-l-4 border-blue-400' :
                        isChild ? 'bg-gray-50 border-l-2 border-gray-300' : ''
                      }`}
                      style={{ height: '9mm' }}
                    >
                      {/* Sequência */}
                      <div className="w-6 flex-shrink-0 text-[10px] font-bold text-center" style={{
                        color: isParent ? '#2563eb' : isChild ? '#6b7280' : '#9333ea'
                      }}>
                        {globalIndex + 1}
                      </div>

                      {/* Nome da tarefa com indentação */}
                      <div className="w-56 flex-shrink-0 px-1.5" style={{ paddingLeft: `${6 + indentLevel * 10}px` }}>
                        <div className="flex items-center gap-0.5">
                          {isChild && <span className="text-gray-400 text-[9px]">└</span>}
                          <div className={`text-[10px] truncate ${isParent ? 'font-bold text-blue-900' : 'font-medium text-gray-900'}`} title={task.name}>
                            {task.name}
                          </div>
                        </div>
                        <div className="text-[8px] text-gray-500">
                          {task.start_date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} -{' '}
                          {task.end_date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </div>
                      </div>

                      {/* Barra do Gantt */}
                      <div className="flex-1 relative h-7 bg-gray-100 rounded">
                        <div
                          className={`absolute h-full rounded shadow-sm ${
                            isParent ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
                            isChild ? 'bg-gradient-to-r from-gray-500 to-gray-400' :
                            'bg-gradient-to-r from-purple-500 to-blue-500'
                          }`}
                          style={{
                            left: `${pos.left}%`,
                            width: `${pos.width}%`,
                            minWidth: '2%'
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-medium">
                            {task.duration_days}d
                          </div>
                        </div>
                      </div>

                      {/* Duração */}
                      <div className="w-14 flex-shrink-0 text-right text-[10px] text-gray-600 px-1.5">
                        {task.duration_days} dias
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Escala de tempo aprimorada no final da página */}
              <div className="mt-2 pt-1.5 border-t-2 border-gray-300 flex-shrink-0">
                <div className="text-[9px] font-medium text-gray-600 mb-1 text-center">
                  Linha do Tempo ({dateRange.days} dias • {Math.ceil(dateRange.days / 7)} semanas)
                </div>
                <div className="flex items-stretch">
                  <div className="w-6"></div>
                  <div className="w-56 px-1.5"></div>
                  <div className="flex-1 relative" style={{ height: '28px' }}>
                    {/* Grid de background para semanas */}
                    <div className="absolute inset-0 flex">
                      {(() => {
                        const weeks: JSX.Element[] = []
                        const currentDate = new Date(dateRange.start)
                        let weekStart = 0

                        while (currentDate <= dateRange.end) {
                          if (currentDate.getDay() === 1 || currentDate.getTime() === dateRange.start.getTime()) {
                            weekStart = Math.ceil((currentDate.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
                          }

                          if (currentDate.getDay() === 0 || currentDate.getTime() === dateRange.end.getTime()) {
                            const weekEnd = Math.ceil((currentDate.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
                            const weekWidth = ((weekEnd - weekStart + 1) / dateRange.days) * 100

                            weeks.push(
                              <div
                                key={`week-${weekStart}`}
                                className="border-r border-gray-300 bg-gray-50"
                                style={{
                                  width: `${weekWidth}%`,
                                  borderLeft: weekStart === 0 ? '1px solid #d1d5db' : 'none'
                                }}
                              />
                            )
                          }

                          currentDate.setDate(currentDate.getDate() + 1)
                        }

                        return weeks
                      })()}
                    </div>

                    {/* Marcadores de mês */}
                    {(() => {
                      const markers: JSX.Element[] = []
                      const currentDate = new Date(dateRange.start)
                      let dayCounter = 0

                      while (currentDate <= dateRange.end) {
                        if (currentDate.getDate() === 1 || dayCounter === 0) {
                          const position = (dayCounter / dateRange.days) * 100
                          const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'short' })
                          const year = currentDate.getFullYear().toString().slice(-2)

                          markers.push(
                            <div
                              key={`month-${dayCounter}`}
                              className="absolute top-0 h-full flex flex-col items-start justify-center border-l-2 border-blue-500"
                              style={{ left: `${position}%` }}
                            >
                              <div className="pl-0.5 text-[8px] font-bold text-blue-700 uppercase tracking-wide">
                                {monthName}
                              </div>
                              <div className="pl-0.5 text-[7px] text-gray-500">
                                '{year}
                              </div>
                            </div>
                          )
                        }
                        currentDate.setDate(currentDate.getDate() + 1)
                        dayCounter++
                      }

                      return markers
                    })()}

                    {/* Marcador de hoje */}
                    {(() => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)

                      if (today >= dateRange.start && today <= dateRange.end) {
                        const daysSinceStart = Math.ceil((today.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
                        const position = (daysSinceStart / dateRange.days) * 100

                        return (
                          <div
                            className="absolute top-0 h-full border-l-2 border-red-500"
                            style={{ left: `${position}%` }}
                          >
                            <div className="absolute -top-3 left-0 transform -translate-x-1/2 bg-red-500 text-white text-[7px] px-0.5 rounded">
                              HOJE
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                  <div className="w-14"></div>
                </div>
              </div>

              {/* Rodapé da página */}
              <div className="mt-1.5 text-[8px] text-gray-400 text-center flex-shrink-0">
                Gerado por Sistema de Gestão de Projetos • {new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Estilos de impressão */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Ocultar elementos de navegação */
          .print\\:hidden {
            display: none !important;
          }

          .print\\:p-0 {
            padding: 0 !important;
          }

          .print\\:shadow-none {
            box-shadow: none !important;
          }

          .print\\:mb-0 {
            margin-bottom: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
