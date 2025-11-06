'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Project, Resource } from '@/types/database.types'
import StatsCard from '@/components/StatsCard'
import ProjectList from '@/components/ProjectList'
import NewProjectForm from '@/components/NewProjectForm'
import ResourceManager from '@/components/ResourceManager'

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [showResourceManager, setShowResourceManager] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

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
    } finally {
      setIsLoading(false)
    }
  }

  function handleNewProjectSuccess() {
    setShowNewProjectForm(false)
    loadDashboardData() // Recarregar dados
  }

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
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowNewProjectForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Novo Projeto</span>
            </button>
            <Link
              href="/import"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 relative"
            >
              <span>📂</span>
              <span>Importar MS Project</span>
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-purple-900 text-xs px-1.5 py-0.5 rounded-full font-bold">
                NOVO
              </span>
            </Link>
            <button
              onClick={() => setShowResourceManager(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <span>👥</span>
              <span>Recursos</span>
            </button>
            <Link
              href="/calendario"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <span>📅</span>
              <span>Calendário</span>
            </Link>
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

        {/* Card Destaque: Importar MS Project */}
        <div className="mb-8">
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 rounded-xl shadow-xl p-6 text-white">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* Conteúdo */}
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2">
                    NOVO 🎉
                  </div>
                  <h3 className="text-2xl font-bold">Importar MS Project</h3>
                  <p className="text-purple-100 mt-2">
                    Migre seus projetos do MS Project 2016+ em segundos
                  </p>
                </div>
                <div className="text-5xl opacity-80">📂</div>
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-300">✓</span>
                  <span>Hierarquia 4+ níveis</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-300">✓</span>
                  <span>Predecessores</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-300">✓</span>
                  <span>Preview completo</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-300">✓</span>
                  <span>Import seguro</span>
                </div>
              </div>

              {/* CTA */}
              <Link
                href="/import"
                className="block w-full md:w-auto md:inline-block text-center px-6 py-3 bg-white text-purple-600 rounded-lg font-bold hover:bg-purple-50 transition-all transform hover:scale-105 shadow-lg"
              >
                📁 Importar Projeto Agora
              </Link>
            </div>
          </div>
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
          
          <ProjectList
            projects={projects}
            resources={resources}
            onRefresh={loadDashboardData}
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Importar MS Project - Destacado */}
            <Link
              href="/import"
              className="p-4 border-2 border-purple-300 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-center group relative"
            >
              <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg">
                NOVO
              </div>
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📂</div>
              <div className="text-sm font-medium text-purple-700">Importar MS Project</div>
              <div className="text-xs text-purple-600 mt-1">XML 2016+</div>
            </Link>

            <button
              onClick={() => setShowResourceManager(true)}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center group"
            >
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">👥</div>
              <div className="text-sm font-medium text-gray-700">Recursos</div>
              <div className="text-xs text-gray-500 mt-1">Gerenciar equipe</div>
            </button>
            <Link
              href="/calendario"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center group"
            >
              <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📅</div>
              <div className="text-sm font-medium text-gray-700">Calendário</div>
              <div className="text-xs text-gray-500 mt-1">Timeline de alocações</div>
            </Link>
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

      {/* Modal do Formulário */}
      {showNewProjectForm && (
        <NewProjectForm 
          onClose={() => setShowNewProjectForm(false)}
          onSuccess={handleNewProjectSuccess}
        />
      )}

      {/* Modal do Gerenciador de Recursos */}
      {showResourceManager && (
        <ResourceManager 
          onClose={() => setShowResourceManager(false)}
        />
      )}

    </div>
  )
}