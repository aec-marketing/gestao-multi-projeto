'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Project, Resource } from '@/types/database.types'
import StatsCard from '@/components/StatsCard'
import ProjectList from '@/components/ProjectList'

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Carregar projetos
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        // Carregar recursos
        const { data: resourcesData } = await supabase
          .from('resources')
          .select('*')
          .eq('is_active', true)
          .order('role', { ascending: true })

        setProjects(projectsData || [])
        setResources(resourcesData || [])
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  // Calcular estatísticas
  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.is_active).length,
    totalResources: resources.length,
    managers: resources.filter(r => r.role === 'gerente').length,
    leaders: resources.filter(r => r.role === 'lider').length,
    operators: resources.filter(r => r.role === 'operador').length
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-40 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Visão geral dos projetos e recursos
            </p>
          </div>
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
              <span>➕</span>
              <span>Novo Projeto</span>
            </button>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2">
              <span>📊</span>
              <span>Relatórios</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Projetos Ativos"
            value={stats.activeProjects}
            description={`${stats.totalProjects} total`}
            icon="📊"
            color="blue"
          />
          <StatsCard
            title="Total de Recursos"
            value={stats.totalResources}
            description="Pessoas na equipe"
            icon="👥"
            color="green"
          />
          <StatsCard
            title="Líderes"
            value={stats.leaders}
            description={`${stats.managers} gerente(s)`}
            icon="👨‍💼"
            color="purple"
          />
          <StatsCard
            title="Operadores"
            value={stats.operators}
            description="Executores dos projetos"
            icon="👷‍♂️"
            color="yellow"
          />
        </div>

        {/* Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Projetos Ativos ({stats.activeProjects})
            </h2>
            <div className="flex space-x-2">
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">Todos os status</option>
                <option value="em_andamento">Em andamento</option>
                <option value="pausado">Pausado</option>
                <option value="concluido">Concluído</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">Todas as categorias</option>
                <option value="projeto_mecanico">Projeto Mecânico</option>
                <option value="projeto_eletrico">Projeto Elétrico</option>
                <option value="projeto_completo">Projeto Completo</option>
                <option value="manutencao">Manutenção</option>
                <option value="retrofit">Retrofit</option>
              </select>
            </div>
          </div>
          
          <ProjectList projects={projects} resources={resources} />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center group">
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📅</div>
              <div className="text-sm font-medium text-gray-700">Calendário</div>
              <div className="text-xs text-gray-500 mt-1">Ver recursos</div>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center group">
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">👥</div>
              <div className="text-sm font-medium text-gray-700">Recursos</div>
              <div className="text-xs text-gray-500 mt-1">Gerenciar equipe</div>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center group">
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📋</div>
              <div className="text-sm font-medium text-gray-700">Templates</div>
              <div className="text-xs text-gray-500 mt-1">Modelos de projeto</div>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center group">
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📈</div>
              <div className="text-sm font-medium text-gray-700">Análises</div>
              <div className="text-xs text-gray-500 mt-1">Métricas e KPIs</div>
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Sistema de Gestão Multi-Projeto • Conectado ao Supabase • {stats.totalResources} recursos ativos</p>
        </div>
      </div>
    </div>
  )
}