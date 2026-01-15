'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ImageUploader from './ImageUploader'

interface ClientLogoModalProps {
  clientName: string
  currentLogoUrl: string | null
  onClose: () => void
  onSave: (logoUrl: string) => void
}

/**
 * ClientLogoModal - Modal para adicionar/editar logo do cliente
 *
 * Permite:
 * - Upload de imagem via ImageUploader (integração com Postimages)
 * - Atualiza a logo na tabela clients
 * - Callback com a nova URL para atualizar o projeto
 */
export default function ClientLogoModal({
  clientName,
  currentLogoUrl,
  onClose,
  onSave,
}: ClientLogoModalProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Close on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleSave() {
    if (!logoUrl) {
      setError('Por favor, faça upload de uma logo primeiro')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Atualizar logo do cliente na tabela clients
      const { error: updateError } = await supabase
        .from('clients')
        .update({ logo_url: logoUrl })
        .eq('name', clientName)

      if (updateError) throw updateError

      // Callback para atualizar o projeto/componente pai
      onSave(logoUrl)
      onClose()
    } catch (err) {
      console.error('Erro ao salvar logo:', err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar logo')
    } finally {
      setIsSaving(false)
    }
  }

  function handleRemoveLogo() {
    setLogoUrl(null)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Adicionar Logo do Cliente</h2>
              <p className="text-sm text-gray-600 mt-1">{clientName}</p>
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

        {/* Body */}
        <div className="p-6">
          <ImageUploader
            currentImageUrl={logoUrl}
            onUploadSuccess={(url) => setLogoUrl(url)}
            onRemove={handleRemoveLogo}
          />

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <span className="text-red-600">⚠️</span>
              <p className="text-sm text-red-700">{error}</p>
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
            disabled={isSaving || !logoUrl}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '⏳ Salvando...' : '✅ Salvar Logo'}
          </button>
        </div>
      </div>
    </div>
  )
}
