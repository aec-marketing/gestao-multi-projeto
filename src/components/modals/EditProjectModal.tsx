'use client'

import { useState, useEffect } from 'react'
import { X, AlertTriangle, Calendar, Target, Edit3 } from 'lucide-react'
import { Project, Resource, Task } from '@/types/database.types'
import { updateProject, getAvailableLeaders } from '@/lib/project-service'
import BufferConfiguration from '@/components/gantt/BufferConfiguration'

interface EditProjectModalProps {
  project: Project
  tasks: Task[]
  onClose: () => void
  onSave: () => void
}

interface EditProjectData {
  code: string
  name: string
  category: string
  vendor_name: string
  leader_id: string | null
  complexity: string
  buffer_days: number
  start_date: string | null
  target_end_date: string | null
  notes: string | null
  is_active: boolean
}

export default function EditProjectModal({ project, tasks, onClose, onSave }: EditProjectModalProps) {
  const [formData, setFormData] = useState<EditProjectData>({
    code: project.code,
    name: project.name,
    category: project.category,
    vendor_name: project.vendor_name,
    leader_id: project.leader_id,
    complexity: project.complexity,
    buffer_days: project.buffer_days,
    start_date: project.start_date,
    target_end_date: null, // Será implementado
    notes: project.notes,
    is_active: project.is_active
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [leaders, setLeaders] = useState<Resource[]>([])

  // Carregar líderes disponíveis
  useEffect(() => {
    const loadLeaders = async () => {
      const availableLeaders = await getAvailableLeaders()
      setLeaders(availableLeaders)
    }

    loadLeaders()
  }, [])

  const categories = [
    { value: 'laudo_tecnico', label: 'Laudo Técnico' },
    { value: 'projeto_mecanico', label: 'Projeto Mecânico' },
    { value: 'projeto_eletrico', label: 'Projeto Elétrico' },
    { value: 'projeto_mecanico_eletrico', label: 'Projeto Mecânico + Elétrico' },
    { value: 'projeto_completo', label: 'Projeto Completo' },
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'readequacao', label: 'Readequação' },
    { value: 'retrofit', label: 'Retrofit' }
  ]

  const complexities = [
    { value: 'simples', label: 'Simples' },
    { value: 'padrao', label: 'Padrão' },
    { value: 'complexo', label: 'Complexo' }
  ]

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.code.trim()) {
      newErrors.code = 'Código é obrigatório'
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }
    if (!formData.vendor_name.trim()) {
      newErrors.vendor_name = 'Nome do fornecedor é obrigatório'
    }
    if (formData.buffer_days < 0) {
      newErrors.buffer_days = 'Buffer não pode ser negativo'
    }

    // Validar datas
    if (formData.start_date && formData.target_end_date) {
      const startDate = new Date(formData.start_date)
      const targetDate = new Date(formData.target_end_date)

      if (targetDate <= startDate) {
        newErrors.target_end_date = 'Data alvo deve ser posterior ao início'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const result = await updateProject(project.id, formData)

      if (result.success) {
        onSave()
        onClose()
      } else {
        setErrors({ submit: result.error || 'Erro ao salvar projeto' })
      }
    } catch (error) {
      setErrors({ submit: 'Erro interno do servidor' })
    }
    setLoading(false)
  }

  const handleInputChange = (field: keyof EditProjectData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Limpar erro do campo quando usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Edit3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Editar Projeto</h2>
              <p className="text-sm text-gray-500">{project.code}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Informações Básicas */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              Informações Básicas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Código */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código*
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.code ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: PRJ-001"
                />
                {errors.code && (
                  <p className="mt-1 text-sm text-red-600">{errors.code}</p>
                )}
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Projeto*
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Nome descritivo do projeto"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria*
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fornecedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fornecedor*
                </label>
                <input
                  type="text"
                  value={formData.vendor_name}
                  onChange={(e) => handleInputChange('vendor_name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.vendor_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Nome do fornecedor/cliente"
                />
                {errors.vendor_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.vendor_name}</p>
                )}
              </div>
            </div>
          </section>

          {/* Configuração */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              Configuração
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Líder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Líder Responsável
                </label>
                <select
                  value={formData.leader_id || ''}
                  onChange={(e) => handleInputChange('leader_id', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Selecionar líder...</option>
                  {leaders.map(leader => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Complexidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Complexidade*
                </label>
                <select
                  value={formData.complexity}
                  onChange={(e) => handleInputChange('complexity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {complexities.map(comp => (
                    <option key={comp.value} value={comp.value}>
                      {comp.label}
                    </option>
                  ))}
                </select>
              </div>


              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Projeto Ativo</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Cronograma */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              Cronograma
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Data Início */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Data de Início
                </label>
                <input
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(e) => handleInputChange('start_date', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Base para cálculo de todas as tarefas
                </p>
              </div>

              {/* Data Alvo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Data Alvo (Limite)
                </label>
                <input
                  type="date"
                  value={formData.target_end_date || ''}
                  onChange={(e) => handleInputChange('target_end_date', e.target.value || null)}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.target_end_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.target_end_date && (
                  <p className="mt-1 text-sm text-red-600">{errors.target_end_date}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Data máxima desejada para entrega
                </p>
              </div>
            </div>

            {/* Info sobre data real */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900">Sobre as datas do projeto</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    A <strong>data real de fim</strong> é calculada automaticamente pela última tarefa + buffer.
                    A <strong>data alvo</strong> serve como referência para controle de prazo.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Buffer Configuration */}
          <section>
            <BufferConfiguration
              project={project}
              tasks={tasks}
              bufferDays={formData.buffer_days}
              onBufferChange={(days) => handleInputChange('buffer_days', days)}
            />
          </section>

          {/* Observações */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              Observações
            </h3>

            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value || null)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Observações, requisitos especiais, etc..."
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          {/* Erro de submissão */}
          <div className="flex-1">
            {errors.submit && (
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {errors.submit}
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
