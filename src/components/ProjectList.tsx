'use client'

import { useState } from 'react'
import { Project, Resource } from '@/types/database.types'
import GanttView from '@/components/GanttView'

interface ProjectListProps {
  projects: Project[]
  resources: Resource[]
}

export default function ProjectList({ projects, resources }: ProjectListProps) {
  const [selectedProjectForGantt, setSelectedProjectForGantt] = useState<string | null>(null)

  const getLeaderName = (leaderId: string | null) => {
    if (!leaderId) return 'Não atribuído'
    const leader = resources.find(r => r.id === leaderId)
    return leader?.name || 'Líder não encontrado'
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      'laudo_tecnico': 'bg-gray-100 text-gray-800',
      'projeto_mecanico': 'bg-blue-100 text-blue-800',
      'projeto_eletrico': 'bg-yellow-100 text-yellow-800',
      'projeto_mecanico_eletrico': 'bg-purple-100 text-purple-800',
      'projeto_completo': 'bg-red-100 text-red-800',
      'manutencao': 'bg-green-100 text-green-800',
      'readequacao': 'bg-orange-100 text-orange-800',
      'retrofit': 'bg-indigo-100 text-indigo-800'
    }
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getCategoryName = (category: string) => {
    const names = {
      'laudo_tecnico': 'Laudo Técnico',
      'projeto_mecanico': 'Projeto Mecânico',
      'projeto_eletrico': 'Projeto Elétrico',
      'projeto_mecanico_eletrico': 'Mecânico + Elétrico',
      'projeto_completo': 'Projeto Completo',
      'manutencao': 'Manutenção',
      'readequacao': 'Readequação',
      'retrofit': 'Retrofit'
    }
    return names[category as keyof typeof names] || category
  }

  const getComplexityColor = (complexity: string) => {
    const colors = {
      'simples': 'bg-green-100 text-green-700',
      'padrao': 'bg-yellow-100 text-yellow-700',
      'complexo': 'bg-red-100 text-red-700'
    }
    return colors[complexity as keyof typeof colors] || 'bg-gray-100 text-gray-700'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Não definido'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR')
    } catch {
      return 'Data inválida'
    }
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum projeto encontrado</h3>
        <p className="text-gray-500 mb-4">Crie seu primeiro projeto para começar</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          ➕ Novo Projeto
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-lg border hover:shadow-md transition-shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                  <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {project.code}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(project.category)}`}>
                    {getCategoryName(project.category)}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getComplexityColor(project.complexity)}`}>
                    {project.complexity}
                  </span>
                  {project.buffer_days > 0 && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      Buffer: {project.buffer_days}d
                    </span>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">👤 Vendedor:</span> {project.vendor_name}
                  </div>
                  <div>
                    <span className="font-medium">👨‍💼 Líder:</span> {getLeaderName(project.leader_id)}
                  </div>
                  <div>
                    <span className="font-medium">📅 Início:</span> {formatDate(project.start_date)}
                  </div>
                  <div>
                    <span className="font-medium">🏁 Fim:</span> {formatDate(project.end_date)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2 ml-4">
                <button 
                  onClick={() => setSelectedProjectForGantt(project.id)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  📊 Gantt
                </button>
                <button className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
                  ✏️ Editar
                </button>
              </div>
            </div>

            {project.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded border-l-4 border-gray-300">
                <p className="text-sm text-gray-700">{project.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal do Gantt */}
      {selectedProjectForGantt && (
        <GanttView 
          projectId={selectedProjectForGantt}
          onClose={() => setSelectedProjectForGantt(null)}
        />
      )}
    </>
  )
}