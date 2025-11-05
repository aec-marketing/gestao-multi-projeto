'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Project, Resource, Task } from '@/types/database.types'
import {
  AllocationWithDetails,
  WorkloadAnalysis,
  PRIORITY_CONFIG,
  WORKLOAD_STATUS,
  DEFAULT_THRESHOLDS
} from '@/types/allocation.types'
import { calculateWorkloadAnalysis, generateTeamSummary } from '@/utils/workload.utils'

interface ResourceManagerProps {
  onClose: () => void
}

export default function ResourceManager({ onClose }: ResourceManagerProps) {
  const [resources, setResources] = useState<Resource[]>([])
  const [allocations, setAllocations] = useState<AllocationWithDetails[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedResource, setSelectedResource] = useState<string | null>(null)
  const [workloadAnalyses, setWorkloadAnalyses] = useState<WorkloadAnalysis[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (resources.length > 0 && allocations.length >= 0) {
      calculateWorkloads()
    }
  }, [resources, allocations])

  async function loadData() {
    try {
      // Carregar recursos
      const { data: resourcesData } = await supabase
        .from('resources')
        .select('*')
        .eq('is_active', true)
        .order('role', { ascending: true })

      // Carregar projetos ativos
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      // Carregar tarefas
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(*)
        `)
        .order('created_at', { ascending: false })

      // Carregar alocações
      const { data: allocationsData } = await supabase
        .from('allocations')
        .select(`
          *,
          resource:resources(*),
          task:tasks(
            *,
            project:projects(*)
          )
        `)
        .order('created_at', { ascending: false })

      setResources(resourcesData || [])
      setProjects(projectsData || [])
      setTasks(tasksData || [])
      setAllocations(allocationsData || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function calculateWorkloads() {
    const analyses = resources.map(resource => 
      calculateWorkloadAnalysis(
        resource.id,
        resource.name,
        resource.role,
        allocations,
        DEFAULT_THRESHOLDS
      )
    )
    setWorkloadAnalyses(analyses)
  }

  function getResourceAnalysis(resourceId: string): WorkloadAnalysis | null {
    return workloadAnalyses.find(analysis => analysis.resourceId === resourceId) || null
  }

  async function removeAllocation(allocationId: string) {
    try {
      await supabase
        .from('allocations')
        .delete()
        .eq('id', allocationId)
      
      loadData()
    } catch (error) {
      console.error('Erro ao remover alocação:', error)
    }
  }

  const teamSummary = workloadAnalyses.length > 0 ? generateTeamSummary(workloadAnalyses) : null

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Carregando recursos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              👥 Gestão de Recursos
            </h2>
            <p className="text-gray-600">
              {resources.length} recursos • {allocations.length} alocações ativas
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de Recursos */}
            <div className="lg:col-span-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Recursos da Equipe
              </h3>
              <div className="space-y-3">
                {resources.map(resource => {
                  const analysis = getResourceAnalysis(resource.id)
                  
                  if (!analysis) return null

                  return (
                    <div
                      key={resource.id}
                      onClick={() => setSelectedResource(
                        selectedResource === resource.id ? null : resource.id
                      )}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedResource === resource.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            {resource.name}
                          </h4>
                          <p className="text-sm text-gray-600 capitalize">
                            {resource.role}
                          </p>
                          {resource.email && (
                            <p className="text-xs text-gray-500 mt-1">
                              {resource.email}
                            </p>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            WORKLOAD_STATUS[analysis.status].color
                          }`}>
                            {WORKLOAD_STATUS[analysis.status].label}
                          </div>
                          {analysis.alerts.length > 0 && (
                            <div className="text-xs text-red-600 mt-1">
                              ⚠️ {analysis.alerts.length} alerta(s)
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Indicadores de Carga */}
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-medium text-gray-900">{analysis.totalTasks}</div>
                          <div className="text-gray-500">Tarefas</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-red-600">{analysis.highPriorityTasks}</div>
                          <div className="text-gray-500">Alta</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-blue-600">{analysis.weeklyHours.toFixed(0)}h</div>
                          <div className="text-gray-500">Semana</div>
                        </div>
                      </div>

                      {/* Barra de Status */}
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              analysis.status === 'critical' ? 'bg-red-500' :
                              analysis.status === 'overload' ? 'bg-orange-500' :
                              analysis.status === 'warning' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ 
                              width: `${Math.min((analysis.totalTasks / DEFAULT_THRESHOLDS.maxTasks) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Detalhes do Recurso Selecionado */}
            <div className="lg:col-span-2">
              {selectedResource ? (
                <ResourceDetails
                  resourceId={selectedResource}
                  resource={resources.find(r => r.id === selectedResource)!}
                  analysis={getResourceAnalysis(selectedResource)!}
                  onRemoveAllocation={removeAllocation}
                />
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <div className="text-6xl mb-4">👤</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Selecione um Recurso
                  </h3>
                  <p className="text-gray-600">
                    Clique em um recurso para ver suas alocações e análise de carga
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Estatísticas da Equipe */}
        {teamSummary && (
          <div className="border-t bg-gray-50 p-4">
            <h4 className="font-medium text-gray-900 mb-3">Resumo da Equipe</h4>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {teamSummary.totalResources}
                </div>
                <div className="text-sm text-gray-600">Recursos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {teamSummary.healthyResources}
                </div>
                <div className="text-sm text-gray-600">Saudáveis</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {teamSummary.warningResources}
                </div>
                <div className="text-sm text-gray-600">Atenção</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {teamSummary.overloadedResources}
                </div>
                <div className="text-sm text-gray-600">Sobrecarga</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {teamSummary.averageTasksPerPerson}
                </div>
                <div className="text-sm text-gray-600">Tarefas/pessoa</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-600">
                  {teamSummary.averageHoursPerPerson}h
                </div>
                <div className="text-sm text-gray-600">Horas/pessoa</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Componente para mostrar detalhes do recurso
function ResourceDetails({ 
  resourceId, 
  resource, 
  analysis,
  onRemoveAllocation 
}: {
  resourceId: string
  resource: Resource
  analysis: WorkloadAnalysis
  onRemoveAllocation: (id: string) => void
}) {
  const resourceAllocations = analysis ? 
    analysis.totalTasks > 0 ? 
      // Buscar alocações reais do banco (seria melhor passar como prop)
      [] : [] 
    : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Análise de {resource.name}
        </h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          WORKLOAD_STATUS[analysis.status].color
        }`}>
          {WORKLOAD_STATUS[analysis.status].label}
        </div>
      </div>

      {/* Alertas */}
      {analysis.alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {analysis.alerts.map((alert, index) => (
            <div key={index} className={`p-3 rounded-lg ${
              alert.severity === 'high' ? 'bg-red-50 border border-red-200' :
              alert.severity === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <div className={`font-medium ${
                alert.severity === 'high' ? 'text-red-800' :
                alert.severity === 'medium' ? 'text-yellow-800' :
                'text-blue-800'
              }`}>
                {alert.message}
              </div>
              {alert.details && (
                <div className={`text-sm mt-1 ${
                  alert.severity === 'high' ? 'text-red-600' :
                  alert.severity === 'medium' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {alert.details}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-gray-900">{analysis.totalTasks}</div>
          <div className="text-sm text-gray-600">Total Tarefas</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">{analysis.highPriorityTasks}</div>
          <div className="text-sm text-red-600">Alta Prioridade</div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{analysis.totalHours.toFixed(1)}h</div>
          <div className="text-sm text-blue-600">Total Horas</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-600">{analysis.weeklyHours.toFixed(1)}h</div>
          <div className="text-sm text-purple-600">Horas/Semana</div>
        </div>
      </div>

      {/* Informação sobre implementação */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <div className="text-blue-800 font-medium">Sistema de Análise Implementado</div>
        <div className="text-blue-600 text-sm mt-1">
          Próximo passo: Implementar alocação de tarefas no contexto do projeto
        </div>
      </div>
    </div>
  )
}