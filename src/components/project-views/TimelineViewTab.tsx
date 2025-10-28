'use client'
import { useState } from 'react'

import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { parseLocalDate } from '@/utils/date.utils'

// Estilos para animação
const styles = `
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
`

// Cores das tarefas (igual ao Gantt)
function getTaskColor(type: string) {
  const colors: Record<string, string> = {
    'projeto_mecanico': 'bg-blue-500',
    'compras_mecanica': 'bg-purple-500',
    'projeto_eletrico': 'bg-yellow-500',
    'compras_eletrica': 'bg-orange-500',
    'fabricacao': 'bg-green-500',
    'tratamento_superficial': 'bg-pink-500',
    'montagem_mecanica': 'bg-indigo-500',
    'montagem_eletrica': 'bg-red-500',
    'coleta': 'bg-teal-500'
  }
  
  return colors[type] || 'bg-gray-500'
}

interface TimelineViewTabProps {
  project: Project
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  onRefresh: () => void
}

export default function TimelineViewTab({
  project,
  tasks,
  resources,
  allocations,
  onRefresh
}: TimelineViewTabProps) {
  
      // ADICIONE ESTE STATE:
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
// ADICIONE ESTES STATES:
const [filterType, setFilterType] = useState<string>('all')
const [filterPerson, setFilterPerson] = useState<string>('all')
const [filterProgress, setFilterProgress] = useState<string>('all')
  // Função para gerar grid de meses
  function generateMonthGrid() {
    if (!project?.start_date || tasks.length === 0) return []

    // Pegar todas as datas
    const allDates = tasks
      .filter(t => t.start_date && t.end_date)
      .flatMap(t => [
        parseLocalDate(t.start_date!),
        parseLocalDate(t.end_date!)
      ])
      .filter(d => d !== null) as Date[]

    if (allDates.length === 0) {
      // Se não tem datas, usar data do projeto
      const projectStart = parseLocalDate(project.start_date)!
      const projectEnd = new Date(projectStart)
      projectEnd.setMonth(projectEnd.getMonth() + 3) // 3 meses de exemplo
      allDates.push(projectStart, projectEnd)
    }

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))

    // Ajustar para início do mês
    const startMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    const endMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)

    // Gerar array de meses
    const months: Date[] = []
    const current = new Date(startMonth)
    
    while (current <= endMonth) {
      months.push(new Date(current))
      current.setMonth(current.getMonth() + 1)
    }

    return months
  }
// Função para gerar todos os dias no período
function generateDayGrid() {
  if (months.length === 0) return []

  const firstMonth = months[0]
  const lastMonth = months[months.length - 1]
  
  // Último dia do último mês
  const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)
  
  const days: Date[] = []
  const current = new Date(firstMonth)
  
  while (current <= endDate) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  
  return days
}
// Função para calcular estilo da barra da tarefa
function getTaskBarStyle(task: Task) {
  if (months.length === 0 || !task.start_date || !task.end_date) {
    return { display: 'none' }
  }

  const taskStart = parseLocalDate(task.start_date)
  const taskEnd = parseLocalDate(task.end_date)
  
  if (!taskStart || !taskEnd) return { display: 'none' }

  // Primeiro e último mês do grid
  const gridStart = months[0]
  const gridEnd = new Date(months[months.length - 1])
  gridEnd.setMonth(gridEnd.getMonth() + 1) // Fim do último mês

  // Calcular total de dias no grid
  const totalGridDays = Math.floor(
    (gridEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Calcular início da tarefa (dias desde início do grid)
  const daysFromStart = Math.max(
    0,
    Math.floor((taskStart.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24))
  )

  // Calcular fim da tarefa (dias desde início do grid)
  const daysFromStartToEnd = Math.floor(
    (taskEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Duração da tarefa em dias
  const taskDurationDays = Math.max(1, daysFromStartToEnd - daysFromStart)

  // Calcular porcentagens
  const leftPercent = (daysFromStart / totalGridDays) * 100
  const widthPercent = (taskDurationDays / totalGridDays) * 100

  return {
    left: `${leftPercent}%`,
    width: `${Math.min(widthPercent, 100 - leftPercent)}%`
  }
}

  const months = generateMonthGrid()
  const days = generateDayGrid()

  // Pegar apenas tarefas principais
  let mainTasks = tasks.filter(t => !t.parent_id)

  // Aplicar filtros
  if (filterType !== 'all') {
    mainTasks = mainTasks.filter(t => t.type === filterType)
  }

  if (filterPerson !== 'all') {
    mainTasks = mainTasks.filter(t =>
      allocations.some(a => a.task_id === t.id && a.resource_id === filterPerson)
    )
  }

  if (filterProgress !== 'all') {
    if (filterProgress === 'not_started') {
      mainTasks = mainTasks.filter(t => t.progress === 0)
    } else if (filterProgress === 'in_progress') {
      mainTasks = mainTasks.filter(t => t.progress > 0 && t.progress < 100)
    } else if (filterProgress === 'completed') {
      mainTasks = mainTasks.filter(t => t.progress === 100)
    }
  }

  return (
    <>
      <style>{styles}</style>

      <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header */}
<div className="p-6 border-b bg-gray-50 space-y-4">
  <div>
    <h2 className="text-lg font-semibold text-gray-900">Timeline do Projeto</h2>
    <p className="text-sm text-gray-600">
      Visão macro • {mainTasks.length} tarefas principais • {months.length} meses
    </p>
  </div>
  
  {/* Barra de filtros */}
  <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
    {/* Filtro por Tipo */}
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Tipo:</label>
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
      >
        <option value="all">Todos</option>
        <option value="projeto_mecanico">Projeto Mecânico</option>
        <option value="compras_mecanica">Compras Mecânica</option>
        <option value="projeto_eletrico">Projeto Elétrico</option>
        <option value="compras_eletrica">Compras Elétrica</option>
        <option value="fabricacao">Fabricação</option>
        <option value="tratamento_superficial">Tratamento Superficial</option>
        <option value="montagem_mecanica">Montagem Mecânica</option>
        <option value="montagem_eletrica">Montagem Elétrica</option>
        <option value="coleta">Coleta</option>
      </select>
    </div>
    
    {/* Filtro por Pessoa */}
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Pessoa:</label>
      <select
        value={filterPerson}
        onChange={(e) => setFilterPerson(e.target.value)}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
      >
        <option value="all">Todas</option>
        {resources.map(resource => (
          <option key={resource.id} value={resource.id}>
            {resource.name}
          </option>
        ))}
      </select>
    </div>
    
    {/* Filtro por Progresso */}
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Status:</label>
      <select
        value={filterProgress}
        onChange={(e) => setFilterProgress(e.target.value)}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
      >
        <option value="all">Todos</option>
        <option value="not_started">Não iniciado (0%)</option>
        <option value="in_progress">Em andamento (1-99%)</option>
        <option value="completed">Concluído (100%)</option>
      </select>
    </div>
    
    {/* Botão limpar filtros */}
    {(filterType !== 'all' || filterPerson !== 'all' || filterProgress !== 'all') && (
      <button
        onClick={() => {
          setFilterType('all')
          setFilterPerson('all')
          setFilterProgress('all')
        }}
        className="ml-auto text-sm text-blue-600 hover:text-blue-700 underline"
      >
        Limpar filtros
      </button>
    )}
  </div>
</div>

{/* Timeline Grid */}
<div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
  <div className="min-w-max">
    {/* Cabeçalho de meses - STICKY */}
    <div className="sticky top-0 z-20 bg-white pb-4 px-6 shadow-sm">
  <div className="flex border-b-2 border-gray-300 shadow-sm">
  {months.map((month, index) => (
    <div
      key={index}
      className="flex-1 text-center py-2 border-r border-gray-200 last:border-r-0"
      style={{ minWidth: '80px' }}
    >
                <div className="text-sm font-semibold text-gray-700">
                  {month.toLocaleDateString('pt-BR', { month: 'short' })}
                </div>
                <div className="text-xs text-gray-500">
                  {month.getFullYear()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Barras de tarefas */}
<div className="space-y-3 px-6 pb-6">
  {mainTasks.length === 0 ? (
    <div className="text-center py-12 text-gray-500">
      <p>Nenhuma tarefa para exibir</p>
    </div>
  ) : (
    mainTasks.map((task) => {
      const barStyle = getTaskBarStyle(task)
      const taskAllocations = allocations.filter(a => a.task_id === task.id)
      
      return (
        <div key={task.id} className="relative">
          {/* Nome da tarefa com badge colorido */}
<div className="flex items-center gap-2 mb-1">
  <span className={`w-3 h-3 rounded-full ${getTaskColor(task.type)}`}></span>
  <span className="text-sm font-medium text-gray-700">
    {task.name}
  </span>
  <span className="text-xs text-gray-500">
    ({task.type.replace(/_/g, ' ')})
  </span>
</div>
          
          {/* Container da barra */}
<div className="relative h-10 bg-gray-100 rounded overflow-hidden">
  {/* Grid de dias (linhas verticais) */}
  <div className="absolute inset-0 flex">
    {days.map((day, index) => {
      // Calcular posição da linha
      const gridStart = months[0]
      const gridEnd = new Date(months[months.length - 1])
      gridEnd.setMonth(gridEnd.getMonth() + 1)
      
      const totalDays = Math.floor(
        (gridEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      const dayPosition = Math.floor(
        (day.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      const leftPercent = (dayPosition / totalDays) * 100
      
      return (
        <div
          key={index}
          className="absolute top-0 bottom-0 border-l border-gray-200"
          style={{ left: `${leftPercent}%` }}
        />
      )
    })}
  </div>
            {/* Barra da tarefa */}
            <div
  className={`absolute top-1 bottom-1 ${getTaskColor(task.type)} rounded shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden`}
  style={barStyle}
  onMouseEnter={() => setHoveredTask(task.id)}
  onMouseLeave={() => setHoveredTask(null)}
>
    
    {/* ADICIONE ESTA BARRA DE PROGRESSO */}
  {task.progress > 0 && (
    <div
      className="absolute inset-0 bg-black bg-opacity-20 rounded"
      style={{
        clipPath: `inset(0 ${100 - task.progress}% 0 0)`
      }}
    />
  )}
  
  <div className="flex items-center justify-between h-full px-2 gap-1 relative z-10">
    {/* Duração */}
    <span className="text-white text-xs font-semibold truncate">
      {Math.ceil(task.duration)}d
    </span>
    
    {/* Badges de pessoas (só mostra se tiver espaço) */}
    {taskAllocations.length > 0 && (
      <div className="flex items-center gap-1">
        {taskAllocations.slice(0, 3).map(alloc => {
          const resource = resources.find(r => r.id === alloc.resource_id)
          const initials = resource?.name
            ?.split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || '??'
          
          return (
            <span
              key={alloc.id}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white bg-opacity-30 text-white text-[10px] font-bold"
              title={resource?.name}
            >
              {initials}
            </span>
          )
        })}
        {taskAllocations.length > 3 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white bg-opacity-30 text-white text-[10px] font-bold">
            +{taskAllocations.length - 3}
          </span>
        )}
      </div>
    )}
  </div>
</div>
          </div>

          {/* Tooltip */}
          {hoveredTask === task.id && (
  <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 animate-fade-in">
              <div className="font-semibold mb-2">{task.name}</div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-300">Tipo:</span>
                  <span>{task.type.replace(/_/g, ' ')}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-300">Duração:</span>
                  <span>{Math.ceil(task.duration)} dias</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-300">Progresso:</span>
                  <span>{task.progress}%</span>
                </div>

                {task.start_date && task.end_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Período:</span>
                    <span>
                      {new Date(task.start_date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                      {' → '}
                      {new Date(task.end_date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}

                {taskAllocations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="text-gray-300 mb-1">Pessoas:</div>
                    <div className="flex flex-wrap gap-1">
                      {taskAllocations.map(alloc => {
                        const resource = resources.find(r => r.id === alloc.resource_id)
                        return (
                          <span
                            key={alloc.id}
                            className="px-2 py-0.5 bg-gray-700 rounded text-white"
                          >
                            {resource?.name || 'N/A'}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Setinha do tooltip */}
              <div className="absolute bottom-full left-8 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-900"></div>
            </div>
          )}

          {/* Info abaixo da barra */}
          <div className="text-xs text-gray-500 mt-1">
            {task.start_date && task.end_date && (
              <>
                {new Date(task.start_date).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short'
                })}
                {' → '}
                {new Date(task.end_date).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short'
                })}
              </>
            )}
            {taskAllocations.length > 0 && (
              <span className="ml-2">
                • {taskAllocations.length} pessoa(s)
              </span>
            )}
          </div>
        </div>
      )
    })
  )}
</div>
      </div>
    </div>
      </div>  {/* ← ADICIONE ESTE FECHAMENTO */}

    </>
  )
}