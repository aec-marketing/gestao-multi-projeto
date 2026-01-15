'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface ImageUploaderProps {
  currentImageUrl?: string | null
  onUploadSuccess: (imageUrl: string) => void
  onRemove?: () => void
}

/**
 * ImageUploader - Upload de imagens para Supabase Storage
 *
 * Funcionalidades:
 * - Drag & Drop de imagens
 * - Clique para selecionar arquivo
 * - Upload automático para Supabase Storage (bucket: client-logos)
 * - Preview da imagem atual
 * - Botão para remover imagem
 * - URLs públicas via CDN do Supabase
 */
export default function ImageUploader({
  currentImageUrl,
  onUploadSuccess,
  onRemove,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadToSupabase(file: File): Promise<string> {
    // Gerar nome único para o arquivo usando timestamp + nome original
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `logos/${fileName}`

    // Upload do arquivo para o bucket 'client-logos'
    const { data, error: uploadError } = await supabase.storage
      .from('client-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    // Obter URL pública do arquivo
    const { data: publicUrlData } = supabase.storage
      .from('client-logos')
      .getPublicUrl(data.path)

    return publicUrlData.publicUrl
  }

  async function handleFileSelect(file: File | null) {
    if (!file) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione apenas arquivos de imagem')
      return
    }

    // Validar tamanho (max 5MB para logos)
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande. Tamanho máximo: 5MB')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const imageUrl = await uploadToSupabase(file)
      onUploadSuccess(imageUrl)
    } catch (err) {
      console.error('Erro no upload:', err)
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload')
    } finally {
      setIsUploading(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    handleFileSelect(file || null)
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    handleFileSelect(file || null)
  }

  function handleClick() {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-3">
      {/* Preview da imagem atual */}
      {currentImageUrl && !isUploading && (
        <div className="relative inline-block">
          <img
            src={currentImageUrl}
            alt="Logo atual"
            className="w-32 h-32 object-contain border-2 border-gray-300 rounded-lg bg-white p-2"
          />
          {onRemove && (
            <button
              onClick={onRemove}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center justify-center text-xs font-bold"
              title="Remover logo"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Área de upload */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-600">Fazendo upload...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-blue-600">Clique para selecionar</span>
              {' ou arraste uma imagem aqui'}
            </div>
            <p className="text-xs text-gray-500">
              PNG, JPG, GIF até 5MB
            </p>
          </div>
        )}
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <span className="text-red-600 text-sm">⚠️</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Info sobre Supabase Storage */}
      <p className="text-xs text-gray-500 text-center">
        As imagens são armazenadas no Supabase Storage de forma segura
      </p>
    </div>
  )
}
