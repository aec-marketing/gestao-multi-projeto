// components/ImportMSProject.tsx
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ImportPreview } from '@/types/database.types'
import ClientSelector from './ClientSelector'

interface ImportMSProjectProps {
  onImportComplete?: () => void
}

export default function ImportMSProject({ onImportComplete }: ImportMSProjectProps) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'metadata'>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)
  const [importedProjectId, setImportedProjectId] = useState<string | null>(null)

  // Metadados adicionais
  const [category, setCategory] = useState<string>('')
  const [leaderId, setLeaderId] = useState<string>('')
  const [vendorName, setVendorName] = useState<string>('')
  const [clientName, setClientName] = useState<string>('')
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null)

  /**
   * Process file (shared between file input and drag-drop)
   */
  const processFile = async (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setLoading(true)

    try {
      // Ler arquivo
      const text = await selectedFile.text()

      // Enviar para API de parse
      const response = await fetch('/api/msproject/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: text })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao processar XML')
      }

      const previewData: ImportPreview = await response.json()
      
      // Converter strings de data para Date objects
      const convertedPreview: ImportPreview = {
        ...previewData,
        project: {
          ...previewData.project,
          startDate: new Date(previewData.project.startDate),
          endDate: new Date(previewData.project.endDate)
        },
        tasks: previewData.tasks.map(task => ({
          ...task,
          start: new Date(task.start),
          finish: new Date(task.finish)
        }))
      }
      
      setPreview(convertedPreview)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle file input change
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    await processFile(selectedFile)
  }

  /**
   * Drag and drop handlers
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (!droppedFile) return

    if (!droppedFile.name.endsWith('.xml')) {
      setError('Por favor, selecione um arquivo .xml')
      return
    }

    await processFile(droppedFile)
  }, [])


  /**
   * Confirmar import após preview
   */
  const handleConfirmImport = async () => {
    if (!preview || !file) return

    setLoading(true)
    setError(null)

    try {
      const text = await file.text()

      const response = await fetch('/api/msproject/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xml: text,
          metadata: {
            category,
            leaderId: leaderId || null,
            vendorName: vendorName || 'Não especificado',
            clientName: clientName || null,
            clientLogoUrl: clientLogoUrl || null
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao importar projeto')
      }

      const result = await response.json()

      // Show success state
      setImportSuccess(true)
      setImportedProjectId(result.projectId)

      // Wait a bit before calling onImportComplete
      setTimeout(() => {
        onImportComplete?.()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  // Progress indicator component
  const ProgressIndicator = () => {
    const steps = [
      { key: 'upload', label: 'Upload', icon: '📁' },
      { key: 'preview', label: 'Preview', icon: '👁️' },
      { key: 'metadata', label: 'Metadados', icon: '📝' },
    ]

    const currentStepIndex = steps.findIndex(s => s.key === step)

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((s, index) => {
          const isActive = s.key === step
          const isCompleted = index < currentStepIndex
          const isLast = index === steps.length - 1

          return (
            <div key={s.key} className="flex items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-xl font-semibold transition-all
                    ${isActive ? 'bg-blue-600 text-white ring-4 ring-blue-200' : ''}
                    ${isCompleted ? 'bg-green-600 text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-gray-200 text-gray-500' : ''}
                  `}
                >
                  {isCompleted ? '✓' : s.icon}
                </div>
                <span
                  className={`
                    mt-2 text-sm font-medium
                    ${isActive ? 'text-blue-600' : ''}
                    ${isCompleted ? 'text-green-600' : ''}
                    ${!isActive && !isCompleted ? 'text-gray-500' : ''}
                  `}
                >
                  {s.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`
                    w-20 h-1 mx-2 rounded transition-all
                    ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}
                  `}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Success modal
  if (importSuccess && importedProjectId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Projeto Importado com Sucesso!
          </h2>
          <p className="text-gray-600 mb-6">
            O projeto foi importado e está pronto para ser utilizado.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/projeto/${importedProjectId}`)}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ver Projeto →
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Voltar
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                📦 Importar MS Project
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Importe projetos do Microsoft Project (.xml)
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <ProgressIndicator />

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-all
                ${isDragging
                  ? 'border-blue-500 bg-blue-50 scale-105'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
                }
                ${loading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
              `}
            >
              <input
                type="file"
                accept=".xml"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />

              {!loading ? (
                <>
                  <div className="text-6xl mb-4">
                    {isDragging ? '📥' : '📁'}
                  </div>
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Selecionar Arquivo XML
                  </label>
                  <p className="mt-4 text-gray-600">
                    ou arraste e solte o arquivo aqui
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    Apenas arquivos .xml do MS Project 2016+
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                  <p className="text-blue-600 font-medium">Processando arquivo...</p>
                  <p className="text-sm text-gray-500 mt-2">Isso pode levar alguns instantes</p>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <span className="text-red-600 text-xl">❌</span>
                <div>
                  <p className="font-medium text-red-900">Erro ao processar arquivo</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

      {/* STEP 2: Preview */}
      {step === 'preview' && preview && (
        <div className="space-y-6">
          {/* Info do Projeto */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Informações do Projeto</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600 text-sm">Código:</span>
                <p className="font-semibold text-gray-900">{preview.project.code}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Nome:</span>
                <p className="font-semibold text-gray-900">{preview.project.name}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Data Início:</span>
                <p className="font-semibold text-gray-900">
                  {preview.project.startDate.toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Data Fim:</span>
                <p className="font-semibold text-gray-900">
                  {preview.project.endDate.toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Total de Tarefas:</span>
                <p className="font-semibold text-gray-900">{preview.project.totalTasks}</p>
              </div>
              <div>
                <span className="text-gray-600 text-sm">Duração:</span>
                <p className="font-semibold text-gray-900">{preview.project.totalDuration} dias</p>
              </div>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📈 Estatísticas</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-blue-50 rounded">
                <p className="text-2xl font-bold text-blue-600">{preview.stats.level1Tasks}</p>
                <p className="text-sm text-gray-600">Tarefas Nível 1</p>
              </div>
              <div className="p-4 bg-green-50 rounded">
                <p className="text-2xl font-bold text-green-600">{preview.stats.level2Tasks}</p>
                <p className="text-sm text-gray-600">Subtarefas Nível 2</p>
              </div>
              <div className="p-4 bg-purple-50 rounded">
                <p className="text-2xl font-bold text-purple-600">{preview.stats.level3PlusTasks}</p>
                <p className="text-sm text-gray-600">Nível 3+</p>
              </div>
              <div className="p-4 bg-orange-50 rounded">
                <p className="text-2xl font-bold text-orange-600">{preview.stats.tasksWithPredecessors}</p>
                <p className="text-sm text-gray-600">Com Predecessores</p>
              </div>
              <div className="p-4 bg-teal-50 rounded">
                <p className="text-2xl font-bold text-teal-600">{preview.stats.completedTasks}</p>
                <p className="text-sm text-gray-600">Completas (100%)</p>
              </div>
              <div className="p-4 bg-red-50 rounded">
                <p className="text-2xl font-bold text-red-600">{preview.stats.criticalTasks}</p>
                <p className="text-sm text-gray-600">Caminho Crítico</p>
              </div>
            </div>
          </div>

          {/* Lista de Tarefas (Primeiras 10) */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Pré-visualização das Tarefas</h2>
            <p className="text-sm text-gray-600 mb-4">
              Mostrando as primeiras 10 tarefas do projeto
            </p>
            <div className="space-y-2">
              {preview.tasks.slice(0, 10).map((task, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                    {task.outlineLevel}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate" title={task.name}>
                      {task.name}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>
                        📅 {task.start.toLocaleDateString('pt-BR')} - {task.finish.toLocaleDateString('pt-BR')}
                      </span>
                      <span>⏱️ {task.duration} dias</span>
                      {task.percentComplete > 0 && (
                        <span className="text-green-600 font-medium">
                          {task.percentComplete}% completo
                        </span>
                      )}
                    </div>
                  </div>
                  {task.predecessors.length > 0 && (
                    <span className="flex-shrink-0 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      {task.predecessors.length} predecessor(es)
                    </span>
                  )}
                </div>
              ))}
            </div>
            {preview.tasks.length > 10 && (
              <p className="text-sm text-gray-500 text-center mt-4">
                + {preview.tasks.length - 10} tarefas adicionais serão importadas
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setStep('upload')
                setFile(null)
                setPreview(null)
              }}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              ← Voltar
            </button>
            <button
              onClick={() => setStep('metadata')}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Metadados */}
      {step === 'metadata' && preview && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📝 Informações Adicionais</h2>

            <div className="space-y-4">
              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria do Projeto *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                  required
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
                    setClientLogoUrl(logoUrl)
                  }}
                  placeholder="Digite o nome do cliente..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  Comece a digitar para buscar clientes existentes ou criar um novo
                </p>
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
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
              </div>

              {/* Líder (opcional por enquanto) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Líder do Projeto (opcional)
                </label>
                <input
                  type="text"
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  placeholder="ID do líder (deixe vazio para definir depois)"
                  className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Você pode definir o líder depois na edição do projeto
                </p>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-4">
            <button
              onClick={() => setStep('preview')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              ← Voltar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={!category || loading}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Importando...' : '✅ Confirmar Import'}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <span className="text-red-600 text-xl">❌</span>
              <div>
                <p className="font-medium text-red-900">Erro ao importar projeto</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}