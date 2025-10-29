'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project, Task, Resource } from '@/types/database.types'
import type { Allocation } from '@/types/allocation.types'
import GanttViewTab from '@/components/project-views/GanttViewTab'
import TableViewTab from '@/components/project-views/TableViewTab'
import TimelineViewTab from './project-views/TimelineViewTab'
import FinancialViewTab from '@/components/project-views/FinancialViewTab'
interface ProjectGanttPageProps {
  projectId: string
  highlightTaskId?: string
}

type ViewMode = 'gantt' | 'table' | 'timeline' | 'financial'

export default function ProjectGanttPage({ projectId, highlightTaskId }: ProjectGanttPageProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('gantt')
  const [loading, setLoading] = useState(true)

  // Carregar dados
  useEffect(() => {
    loadProjectData()
  }, [projectId])

  async function loadProjectData() {
    setLoading(true)
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

      // Carregar alocações
      const { data: allocationsData } = await supabase
        .from('allocations')
        .select(`
          *,
          resource:resources(*)
        `)
        .in('task_id', tasksData?.map(t => t.id) || [])

      setProject(projectData)
      setTasks(tasksData || [])
      setResources(resourcesData || [])
      setAllocations(allocationsData || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando projeto...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">Projeto não encontrado</p>
          <a href="/" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            ← Voltar para Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Voltar
              </a>
              <div className="border-l h-6"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {project.name}
                </h1>
                <p className="text-sm text-gray-600">
                  {project.code} • {tasks.length} tarefas
                </p>
              </div>
            </div>

            {/* Ações rápidas */}
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                💾 Salvar
              </button>
              <button className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                📤 Exportar
              </button>
              <button className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                ⚙️ Configurações
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 mt-4 border-b">
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                viewMode === 'gantt'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              📊 Gantt
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                viewMode === 'table'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              📋 Tabela
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                viewMode === 'timeline'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              🗓️ Timeline
            </button>
            <button
              onClick={() => setViewMode('financial')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                viewMode === 'financial'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              💰 Financeiro
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="p-6">
        {viewMode === 'gantt' && (
          <GanttViewTab
            project={project}
            tasks={tasks}
            resources={resources}
            allocations={allocations}
            onRefresh={loadProjectData}
            highlightTaskId={highlightTaskId}
          />
        )}

        {viewMode === 'table' && (
          <TableViewTab
            project={project}
            tasks={tasks}
            resources={resources}
            allocations={allocations}
            onRefresh={loadProjectData}
          />
        )}

        {viewMode === 'timeline' && (
  <TimelineViewTab
    project={project}
    tasks={tasks}
    resources={resources}
    allocations={allocations}
    onRefresh={loadProjectData}
  />
)}

        {viewMode === 'financial' && (
  <FinancialViewTab
    project={project}
    tasks={tasks}
    resources={resources}
    allocations={allocations}
    onRefresh={loadProjectData}
  />
)}
      </main>
    </div>
  )
}

// ============================================================================
// PLACEHOLDERS (implementar depois)
// ============================================================================

function TimelineViewPlaceholder() {
  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline do Projeto</h2>
      <div className="border rounded-lg p-8 text-center text-gray-500">
        <p>🗓️ Visão de timeline macro (meses/trimestres)</p>
        <p className="text-sm mt-2">Em desenvolvimento</p>
      </div>
    </div>
  )
}

function FinancialViewPlaceholder() {
  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <div className="text-sm text-gray-600 mb-1">Custo Total</div>
          <div className="text-2xl font-bold text-gray-900">R$ 0,00</div>
          <div className="text-xs text-gray-500 mt-1">Em desenvolvimento</div>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <div className="text-sm text-gray-600 mb-1">Receita</div>
          <div className="text-2xl font-bold text-gray-900">R$ 0,00</div>
          <div className="text-xs text-gray-500 mt-1">Em desenvolvimento</div>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <div className="text-sm text-gray-600 mb-1">Margem</div>
          <div className="text-2xl font-bold text-green-600">0%</div>
          <div className="text-xs text-gray-500 mt-1">Em desenvolvimento</div>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <div className="text-sm text-gray-600 mb-1">Status</div>
          <div className="text-2xl font-bold text-blue-600">No prazo</div>
          <div className="text-xs text-gray-500 mt-1">Em desenvolvimento</div>
        </div>
      </div>

      {/* Tabela Financeira */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Breakdown Financeiro
        </h3>
        <div className="text-center text-gray-500 py-12">
          <p>💰 Dashboard financeiro em desenvolvimento</p>
          <p className="text-sm mt-2">
            Aqui aparecerão custos por categoria, fornecedores, etc.
          </p>
        </div>
      </div>
    </div>
  )
}