'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Resource, ProjectInsert } from '@/types/database.types'

interface NewProjectFormProps {
  onClose: () => void
  onSuccess: () => void
}

type ProjectCategory = 'laudo_tecnico' | 'projeto_mecanico' | 'projeto_eletrico' | 'projeto_mecanico_eletrico' | 'projeto_completo' | 'manutencao' | 'readequacao' | 'retrofit'
type ProjectComplexity = 'simples' | 'padrao' | 'complexo'

const categoryTasks = {
  'laudo_tecnico': [
    { name: 'Análise Técnica', type: 'projeto_mecanico', duration: 2, required: true },
    { name: 'Relatório de Laudo', type: 'subtarefa', duration: 1, required: true },
    { name: 'Revisão Técnica', type: 'subtarefa', duration: 0.5, required: false }
  ],
  'projeto_mecanico': [
    { name: 'Projeto Mecânico', type: 'projeto_mecanico', duration: 3, required: true },
    { name: 'Compras Lista Mecânica', type: 'compras_mecanica', duration: 2, required: true },
    { name: 'Fabricação', type: 'fabricacao', duration: 5, required: true },
    { name: 'Montagem Mecânica', type: 'montagem_mecanica', duration: 2, required: true },
    { name: 'Coleta', type: 'coleta', duration: 1, required: true }
  ],
  'projeto_eletrico': [
    { name: 'Projeto Elétrico', type: 'projeto_eletrico', duration: 4, required: true },
    { name: 'Compras Lista Elétrica', type: 'compras_eletrica', duration: 2, required: true },
    { name: 'Montagem Elétrica', type: 'montagem_eletrica', duration: 3, required: true },
    { name: 'Coleta', type: 'coleta', duration: 1, required: true }
  ],
  'projeto_mecanico_eletrico': [
    { name: 'Projeto Mecânico', type: 'projeto_mecanico', duration: 4, required: true },
    { name: 'Compras Lista Mecânica', type: 'compras_mecanica', duration: 2, required: true },
    { name: 'Projeto Elétrico', type: 'projeto_eletrico', duration: 4, required: true },
    { name: 'Compras Lista Elétrica', type: 'compras_eletrica', duration: 2, required: true },
    { name: 'Fabricação', type: 'fabricacao', duration: 6, required: true },
    { name: 'Montagem Mecânica', type: 'montagem_mecanica', duration: 3, required: true },
    { name: 'Montagem Elétrica', type: 'montagem_eletrica', duration: 3, required: true },
    { name: 'Coleta', type: 'coleta', duration: 1, required: true }
  ],
  'projeto_completo': [
    { name: 'Projeto Mecânico', type: 'projeto_mecanico', duration: 5, required: true },
    { name: 'Compras Lista Mecânica', type: 'compras_mecanica', duration: 3, required: true },
    { name: 'Projeto Elétrico', type: 'projeto_eletrico', duration: 4, required: true },
    { name: 'Compras Lista Elétrica', type: 'compras_eletrica', duration: 2, required: true },
    { name: 'Fabricação', type: 'fabricacao', duration: 8, required: true },
    { name: 'Tratamento Superficial', type: 'tratamento_superficial', duration: 3, required: false },
    { name: 'Montagem Mecânica', type: 'montagem_mecanica', duration: 4, required: true },
    { name: 'Montagem Elétrica', type: 'montagem_eletrica', duration: 3, required: true },
    { name: 'Programação', type: 'subtarefa', duration: 2, required: false },
    { name: 'Coleta', type: 'coleta', duration: 1, required: true }
  ],
  'manutencao': [
    { name: 'Diagnóstico', type: 'subtarefa', duration: 1, required: true },
    { name: 'Compras de Peças', type: 'compras_mecanica', duration: 2, required: false },
    { name: 'Execução da Manutenção', type: 'montagem_mecanica', duration: 2, required: true },
    { name: 'Teste Final', type: 'coleta', duration: 0.5, required: true }
  ],
  'readequacao': [
    { name: 'Análise da Situação Atual', type: 'projeto_mecanico', duration: 2, required: true },
    { name: 'Projeto de Readequação', type: 'projeto_mecanico', duration: 3, required: true },
    { name: 'Compras', type: 'compras_mecanica', duration: 2, required: true },
    { name: 'Implementação', type: 'montagem_mecanica', duration: 4, required: true },
    { name: 'Coleta', type: 'coleta', duration: 1, required: true }
  ],
  'retrofit': [
    { name: 'Avaliação do Sistema Existente', type: 'projeto_mecanico', duration: 3, required: true },
    { name: 'Projeto de Modernização', type: 'projeto_mecanico', duration: 4, required: true },
    { name: 'Projeto Elétrico Atualizado', type: 'projeto_eletrico', duration: 3, required: false },
    { name: 'Compras de Modernização', type: 'compras_mecanica', duration: 3, required: true },
    { name: 'Instalação e Retrofit', type: 'montagem_mecanica', duration: 5, required: true },
    { name: 'Comissionamento', type: 'coleta', duration: 2, required: true }
  ]
}

export default function NewProjectForm({ onClose, onSuccess }: NewProjectFormProps) {
  const [leaders, setLeaders] = useState<Resource[]>([])
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '' as ProjectCategory,
    vendor_name: '',
    leader_id: '',
    complexity: 'padrao' as ProjectComplexity,
    buffer_days: 0,
    start_date: '',
    notes: ''
  })
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadLeaders()
  }, [])

  useEffect(() => {
    if (formData.category) {
      const tasks = categoryTasks[formData.category]
      const requiredTasks = new Set(
        tasks.filter(task => task.required).map(task => task.name)
      )
      setSelectedTasks(requiredTasks)
    }
  }, [formData.category])

  async function loadLeaders() {
    const { data } = await supabase
      .from('resources')
      .select('*')
      .in('role', ['gerente', 'lider'])
      .eq('is_active', true)
      .order('role', { ascending: true })
    
    setLeaders(data || [])
  }

  const categoryLabels = {
    'laudo_tecnico': 'Laudo Técnico',
    'projeto_mecanico': 'Projeto Mecânico',
    'projeto_eletrico': 'Projeto Elétrico', 
    'projeto_mecanico_eletrico': 'Projeto Mecânico + Elétrico',
    'projeto_completo': 'Projeto Completo',
    'manutencao': 'Manutenção',
    'readequacao': 'Readequação',
    'retrofit': 'Retrofit'
  }

  const complexityLabels = {
    'simples': 'Simples',
    'padrao': 'Padrão', 
    'complexo': 'Complexo'
  }

  function validateForm() {
    const newErrors: Record<string, string> = {}

    if (!formData.code.trim()) newErrors.code = 'Código é obrigatório'
    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório'
    if (!formData.category) newErrors.category = 'Categoria é obrigatória'
    if (!formData.vendor_name.trim()) newErrors.vendor_name = 'Vendedor é obrigatório'
    if (!formData.start_date) newErrors.start_date = 'Data de início é obrigatória'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsLoading(true)

    try {
      // Criar projeto
      const projectData: ProjectInsert = {
        code: formData.code,
        name: formData.name,
        category: formData.category,
        vendor_name: formData.vendor_name,
        leader_id: formData.leader_id || null,
        complexity: formData.complexity,
        buffer_days: formData.buffer_days,
        start_date: formData.start_date,
        notes: formData.notes || null
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single()

      if (projectError) throw projectError

      // Criar tarefas selecionadas
      if (formData.category && selectedTasks.size > 0) {
        const tasks = categoryTasks[formData.category]
        const tasksToCreate = tasks
          .filter(task => selectedTasks.has(task.name))
          .map((task, index) => ({
            project_id: project.id,
            name: task.name,
            type: task.type as any,
            duration: task.duration,
            sort_order: index + 1,
            is_optional: !task.required
          }))

        const { error: tasksError } = await supabase
          .from('tasks')
          .insert(tasksToCreate)

        if (tasksError) throw tasksError
      }

      onSuccess()
    } catch (error) {
      setErrors({ submit: 'Erro ao criar projeto. Tente novamente.' })
    } finally {
      setIsLoading(false)
    }
  }

  function toggleTask(taskName: string) {
    const task = categoryTasks[formData.category]?.find(t => t.name === taskName)
    if (task?.required) return // Não pode desmarcar tarefas obrigatórias

    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskName)) {
      newSelected.delete(taskName)
    } else {
      newSelected.add(taskName)
    }
    setSelectedTasks(newSelected)
  }

  const availableTasks = formData.category ? categoryTasks[formData.category] : []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Novo Projeto</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código do Projeto *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="PRJ-001"
                />
                {errors.code && <p className="text-red-600 text-sm mt-1">{errors.code}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ProjectCategory }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="">Selecione uma categoria</option>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {errors.category && <p className="text-red-600 text-sm mt-1">{errors.category}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Projeto *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                placeholder="Automação da Linha de Produção"
              />
              {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendedor Responsável *
                </label>
                <input
                  type="text"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="João Silva"
                />
                {errors.vendor_name && <p className="text-red-600 text-sm mt-1">{errors.vendor_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Líder do Projeto
                </label>
                <select
                  value={formData.leader_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, leader_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="">Selecionar depois</option>
                  {leaders.map(leader => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name} ({leader.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Complexidade
                </label>
                <select
                  value={formData.complexity}
                  onChange={(e) => setFormData(prev => ({ ...prev, complexity: e.target.value as ProjectComplexity }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  {Object.entries(complexityLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buffer (dias)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={formData.buffer_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, buffer_days: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Início *
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                />
                {errors.start_date && <p className="text-red-600 text-sm mt-1">{errors.start_date}</p>}
              </div>
            </div>

            {/* Tarefas */}
            {availableTasks.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Tarefas do Projeto
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {availableTasks.map(task => (
                    <label key={task.name} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedTasks.has(task.name)}
                        onChange={() => toggleTask(task.name)}
                        disabled={task.required}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className={`text-sm ${task.required ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {task.name} ({task.duration}d)
                        {task.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  * Tarefas obrigatórias não podem ser desmarcadas
                </p>
              </div>
            )}

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                placeholder="Observações adicionais sobre o projeto..."
              />
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Botões */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Criando...' : 'Criar Projeto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}