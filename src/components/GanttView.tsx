'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Project, Task, Resource } from '@/types/database.types'

interface GanttViewProps {
  projectId: string
  onClose: () => void
}

interface TaskWithDates extends Omit<Task, 'start_date' | 'end_date'> {
  start_date: Date
  end_date: Date
  duration_days: number
}

export default function GanttView({ projectId, onClose }: GanttViewProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [dragOverTask, setDragOverTask] = useState<string | null>(null)

  useEffect(() => {
    loadProjectData()
  }, [projectId])

  async function loadProjectData() {
    try {
      // Carregar projeto
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      // Carregar tarefas
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })

      // Carregar recursos
      const { data: resourcesData } = await supabase
        .from('resources')
        .select('*')
        .eq('is_active', true)

      setProject(projectData)
      setTasks(tasksData || [])
      setResources(resourcesData || [])
    } catch (error) {
      console.error('Erro ao carregar dados do projeto:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Calcular datas das tarefas baseado na data de início do projeto
  function calculateTaskDates(): TaskWithDates[] {
    if (!project?.start_date) return []

    const projectStart = new Date(project.start_date)
    let currentDate = new Date(projectStart)
    
    return tasks.map(task => {
      const startDate = new Date(currentDate)
      const endDate = new Date(currentDate)
      endDate.setDate(endDate.getDate() + Math.ceil(task.duration))
      
      // Próxima tarefa começa no dia seguinte ao fim desta
      currentDate = new Date(endDate)
      currentDate.setDate(currentDate.getDate() + 1)
      
      return {
        ...task,
        start_date: startDate,
        end_date: endDate,
        duration_days: Math.ceil(task.duration)
      }
    })
  }

  // Gerar grid de datas para o cabeçalho
  function generateDateGrid() {
    if (!project?.start_date) return []
    
    const projectStart = new Date(project.start_date)
    const totalDuration = tasks.reduce((sum, task) => sum + Math.ceil(task.duration), 0)
    const dates = []
    
    for (let i = 0; i < totalDuration + 10; i++) {
      const date = new Date(projectStart)
      date.setDate(date.getDate() + i)
      dates.push(date)
    }
    
    return dates
  }

  const tasksWithDates = calculateTaskDates()
  const dateGrid = generateDateGrid()

  function getTaskBarStyle(task: TaskWithDates) {
    if (!project?.start_date) return { width: '0%', left: '0%' }
    
    const projectStart = new Date(project.start_date)
    const taskStart = new Date(task.start_date)
    const daysSinceStart = Math.floor((taskStart.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24))
    const duration = task.duration_days
    
    const startPercentage = (daysSinceStart / dateGrid.length) * 100
    const widthPercentage = (duration / dateGrid.length) * 100
    
    return {
      left: `${startPercentage}%`,
      width: `${widthPercentage}%`
    }
  }

  function getTaskColor(taskType: string) {
    const colors = {
      'projeto_mecanico': 'bg-blue-500',
      'projeto_eletrico': 'bg-yellow-500',
      'compras_mecanica': 'bg-green-500',
      'compras_eletrica': 'bg-green-600',
      'fabricacao': 'bg-purple-500',
      'montagem_mecanica': 'bg-indigo-500',
      'montagem_eletrica': 'bg-orange-500',
      'coleta': 'bg-red-500',
      'tratamento_superficial': 'bg-pink-500',
      'subtarefa': 'bg-gray-500'
    }
    return colors[taskType as keyof typeof colors] || 'bg-gray-400'
  }

  async function updateTaskProgress(taskId: string, progress: number) {
    try {
      await supabase
        .from('tasks')
        .update({ progress })
        .eq('id', taskId)
      
      // Recarregar tarefas
      loadProjectData()
    } catch (error) {
      console.error('Erro ao atualizar progresso:', error)
    }
  }

  // Funções de Drag & Drop
  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDraggedTask(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, taskId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTask(taskId)
  }

  function handleDragLeave() {
    setDragOverTask(null)
  }

  async function handleDrop(e: React.DragEvent, targetTaskId: string) {
    e.preventDefault()
    
    if (!draggedTask || draggedTask === targetTaskId) {
      setDraggedTask(null)
      setDragOverTask(null)
      return
    }

    try {
      // Encontrar índices das tarefas
      const draggedIndex = tasks.findIndex(t => t.id === draggedTask)
      const targetIndex = tasks.findIndex(t => t.id === targetTaskId)
      
      if (draggedIndex === -1 || targetIndex === -1) return

      // Criar nova ordem das tarefas
      const newTasks = [...tasks]
      const [draggedTaskObj] = newTasks.splice(draggedIndex, 1)
      newTasks.splice(targetIndex, 0, draggedTaskObj)

      // Atualizar sort_order no banco
      const updates = newTasks.map((task, index) => ({
        id: task.id,
        sort_order: index + 1
      }))

      for (const update of updates) {
        await supabase
          .from('tasks')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)
      }

      // Recarregar dados
      loadProjectData()
    } catch (error) {
      console.error('Erro ao reordenar tarefas:', error)
    } finally {
      setDraggedTask(null)
      setDragOverTask(null)
    }
  }

  function handleDragEnd() {
    setDraggedTask(null)
    setDragOverTask(null)
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Carregando projeto...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              📊 Gantt - {project?.name}
            </h2>
            <p className="text-gray-600">
              {project?.code} • {tasksWithDates.length} tarefas • Arraste para reordenar
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Gantt Chart */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[1200px]">
            {/* Header com datas */}
            <div className="grid grid-cols-[300px_1fr] border-b bg-gray-50">
              <div className="p-3 border-r font-medium text-gray-700">
                <div className="flex items-center space-x-2">
                  <span>Tarefas</span>
                  <span className="text-xs text-gray-500">🔄 Arraste para reordenar</span>
                </div>
              </div>
              <div className="relative">
                <div className="flex">
                  {dateGrid.map((date, index) => (
                    <div
                      key={index}
                      className="flex-1 min-w-[40px] p-2 border-r text-xs text-center text-gray-600"
                    >
                      <div>{date.getDate()}</div>
                      <div className="text-gray-400">
                        {date.toLocaleDateString('pt-BR', { month: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Linhas de tarefas */}
            <div className="divide-y">
              {tasksWithDates.map((task, index) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragOver={(e) => handleDragOver(e, task.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={`grid grid-cols-[300px_1fr] transition-colors cursor-move ${
                    selectedTask === task.id ? 'bg-blue-50' : 
                    dragOverTask === task.id ? 'bg-yellow-50' :
                    draggedTask === task.id ? 'bg-gray-100 opacity-50' : 
                    'hover:bg-gray-50'
                  }`}
                >
                  {/* Coluna da tarefa */}
                  <div 
                    className="p-3 border-r cursor-pointer"
                    onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400 text-sm">⋮⋮</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">
                          {task.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {task.duration}d • {task.progress || 0}% completo
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center mt-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${task.progress || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {task.progress || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Coluna do cronograma */}
                  <div className="relative h-16 border-r">
                    {/* Grid de datas */}
                    <div className="absolute inset-0 flex">
                      {dateGrid.map((_, index) => (
                        <div
                          key={index}
                          className="flex-1 min-w-[40px] border-r border-gray-100"
                        />
                      ))}
                    </div>

                    {/* Barra da tarefa */}
                    <div
                      className={`absolute top-1/2 transform -translate-y-1/2 h-6 rounded ${getTaskColor(task.type)} opacity-80 hover:opacity-100 cursor-pointer flex items-center justify-center transition-all`}
                      style={getTaskBarStyle(task)}
                      onClick={() => setSelectedTask(task.id)}
                    >
                      <span className="text-white text-xs font-medium">
                        {task.duration}d
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Painel de detalhes da tarefa selecionada */}
        {selectedTask && (
          <div className="border-t bg-gray-50 p-4">
            {(() => {
              const task = tasksWithDates.find(t => t.id === selectedTask)
              if (!task) return null
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{task.name}</h4>
                    <p className="text-sm text-gray-600">
                      Duração: {task.duration} dias
                    </p>
                    <p className="text-sm text-gray-600">
                      Tipo: {task.type.replace('_', ' ')}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">
                      Início: {task.start_date.toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-sm text-gray-600">
                      Fim: {task.end_date.toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Progresso
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={task.progress || 0}
                      onChange={(e) => updateTaskProgress(task.id, parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0%</span>
                      <span>{task.progress || 0}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Footer com legenda */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Legenda:</h4>
              <div className="flex flex-wrap gap-4 text-xs text-gray-700">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                  <span className="text-gray-700">Projeto Mecânico</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
                  <span className="text-gray-700">Projeto Elétrico</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                  <span className="text-gray-700">Compras</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-purple-500 rounded mr-2"></div>
                  <span className="text-gray-700">Fabricação</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-indigo-500 rounded mr-2"></div>
                  <span className="text-gray-700">Montagem</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                  <span className="text-gray-700">Coleta</span>
                </div>
              </div>
            </div>
            
            <div className="text-right text-xs text-gray-500">
              <p>💡 Arraste as tarefas para reordenar</p>
              <p>📊 Clique na barra para ver detalhes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}