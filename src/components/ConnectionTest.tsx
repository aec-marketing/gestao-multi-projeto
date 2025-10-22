'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Project, Resource } from '@/types/database.types'

export default function ConnectionTest() {
  const [projects, setProjects] = useState<Project[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function testConnection() {
      try {
        console.log('🔄 Testando conexão com Supabase...')
        
        // Testar busca de projetos
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (projectsError) {
          console.error('❌ Erro ao buscar projetos:', projectsError)
          setError(`Erro projetos: ${projectsError.message}`)
        } else {
          console.log('✅ Projetos carregados:', projectsData?.length || 0)
          setProjects(projectsData || [])
        }

        // Testar busca de recursos
        const { data: resourcesData, error: resourcesError } = await supabase
          .from('resources')
          .select('*')
          .order('role', { ascending: true })

        if (resourcesError) {
          console.error('❌ Erro ao buscar recursos:', resourcesError)
          setError(`Erro recursos: ${resourcesError.message}`)
        } else {
          console.log('✅ Recursos carregados:', resourcesData?.length || 0)
          setResources(resourcesData || [])
        }

      } catch (err) {
        console.error('❌ Erro geral:', err)
        setError(`Erro geral: ${err}`)
      } finally {
        setIsLoading(false)
      }
    }

    testConnection()
  }, [])

  if (isLoading) {
    return (
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="flex items-center space-x-2">
          <div className="animate-spin w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
          <span className="text-yellow-700">Conectando ao Supabase...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <div className="text-red-800 font-medium">❌ Erro de conexão:</div>
        <div className="text-red-600 text-sm mt-1">{error}</div>
        <div className="text-xs text-red-500 mt-2">
          Verifique as credenciais no .env.local e as políticas RLS no Supabase
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <div className="text-green-800 font-medium">
          ✅ Conexão Supabase funcionando!
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="font-semibold text-gray-800 mb-3">
            📊 Projetos ({projects.length})
          </h3>
          {projects.length > 0 ? (
            <div className="space-y-2">
              {projects.map((project) => (
                <div key={project.id} className="p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                  <div className="font-medium text-blue-900">{project.name}</div>
                  <div className="text-sm text-blue-700">
                    {project.code} • {project.category} • {project.complexity}
                  </div>
                  <div className="text-xs text-blue-600">
                    Vendedor: {project.vendor_name}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">Nenhum projeto encontrado</div>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="font-semibold text-gray-800 mb-3">
            👥 Recursos ({resources.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {resources.map((resource) => (
              <div key={resource.id} className="p-2 bg-gray-50 rounded border-l-4 border-gray-400">
                <div className="flex justify-between items-center">
                  <div className="font-medium text-gray-900">{resource.name}</div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    resource.role === 'gerente' ? 'bg-purple-100 text-purple-800' :
                    resource.role === 'lider' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {resource.role}
                  </span>
                </div>
                {resource.email && (
                  <div className="text-xs text-gray-600">{resource.email}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}