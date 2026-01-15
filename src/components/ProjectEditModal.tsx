'use client'

import { useState, useEffect } from 'react'
import { Project, Resource } from '@/types/database.types'
import { supabase } from '@/lib/supabase'
import ClientSelector from './ClientSelector'
import ClientLogoModal from './ClientLogoModal'

interface ProjectEditModalProps {
  project: Project
  resources: Resource[]
  onClose: () => void
  onSave: () => void
}

/**
 * ProjectEditModal - Modal para editar informações do projeto
 * Permite editar categoria, líder, vendedor, cliente e logo
 */
export default function ProjectEditModal({
  project,
  resources,
  onClose,
  onSave,
}: ProjectEditModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [category, setCategory] = useState<string>(project.category || '')
  const [leaderId, setLeaderId] = useState<string>(project.leader_id || '')
  const [vendorName, setVendorName] = useState<string>(project.vendor_name || '')
  const [clientName, setClientName] = useState<string>(project.client_name || '')
  const [clientLogoUrl, setClientLogoUrl] = useState<string>(project.client_logo_url || '')
  const [notes, setNotes] = useState<string>(project.notes || '')
  const [showLogoModal, setShowLogoModal] = useState(false)

  // Filter leaders and managers
  const leaders = resources.filter(
    r => r.hierarchy === 'lider' || r.hierarchy === 'gerente'
  )

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          category,
          leader_id: leaderId || null,
          vendor_name: vendorName || null,
          client_name: clientName || null,
          client_logo_url: clientLogoUrl || null,
          notes: notes || null,
        })
        .eq('id', project.id)

      if (updateError) throw updateError

      onSave()
      onClose()
    } catch (err) {
      console.error('Erro ao salvar projeto:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsSaving(false)
    }
  }

  // Close on ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Editar Projeto</h2>
              <p className="text-sm text-gray-600 mt-1">
                {project.code} - {project.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              title="Fechar (ESC)"
            >
              ×
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria do Projeto *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            >
              <option value="">Selecione...</option>
              <option value="laudo_tecnico">Laudo Técnico</option>
              <option value="projeto_mecanico">Projeto Mecânico</option>
              <option value="projeto_eletrico">Projeto Elétrico</option>
              <option value="projeto_mecanico_eletrico">Projeto Mecânico + Elétrico</option>
              <option value="projeto_completo">Projeto Completo</option>
              <option value="manutencao">Manutenção</option>
              <option value="readequacao">Readequação</option>
              <option value="retrofit">Retrofit</option>
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente
            </label>
            <ClientSelector
              value={clientName}
              onSelect={(name, logoUrl) => {
                setClientName(name)
                setClientLogoUrl(logoUrl || '')
              }}
              placeholder="Digite o nome do cliente..."
            />
            <p className="text-sm text-gray-500 mt-1">
              Busque clientes existentes ou crie um novo
            </p>

            {/* Logo do Cliente */}
            <div className="mt-3 flex items-center gap-3">
              {clientLogoUrl && (
                <img
                  src={clientLogoUrl}
                  alt="Logo do cliente"
                  className="w-16 h-16 object-contain rounded border border-gray-300 bg-white p-1"
                />
              )}
              {clientName && (
                <button
                  type="button"
                  onClick={() => setShowLogoModal(true)}
                  className="px-3 py-2 text-sm border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {clientLogoUrl ? '✏️ Alterar Logo' : '➕ Adicionar Logo'}
                </button>
              )}
            </div>
          </div>

          {/* Líder do Projeto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Líder do Projeto
            </label>
            <select
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            >
              <option value="">Nenhum líder atribuído</option>
              {leaders.map(leader => (
                <option key={leader.id} value={leader.id}>
                  {leader.name} ({leader.hierarchy === 'gerente' ? 'Gerente' : 'Líder'})
                  {leader.role && ` - ${leader.role}`}
                </option>
              ))}
            </select>
          </div>

          {/* Vendedor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendedor Responsável
            </label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Nome do vendedor"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre o projeto..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <span className="text-red-600 text-xl">❌</span>
              <div>
                <p className="font-medium text-red-900">Erro ao salvar</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !category}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '⏳ Salvando...' : '✅ Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Modal de Logo do Cliente */}
      {showLogoModal && clientName && (
        <ClientLogoModal
          clientName={clientName}
          currentLogoUrl={clientLogoUrl}
          onClose={() => setShowLogoModal(false)}
          onSave={(logoUrl) => {
            setClientLogoUrl(logoUrl)
            setShowLogoModal(false)
          }}
        />
      )}
    </div>
  )
}
