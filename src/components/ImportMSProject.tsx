// components/ImportMSProject.tsx
'use client'

import { useState } from 'react'
import type { ImportPreview } from '@/types/database.types'

interface ImportMSProjectProps {
  onImportComplete?: () => void
}

export default function ImportMSProject({ onImportComplete }: ImportMSProjectProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'metadata'>('upload')

  // Metadados adicionais
  const [category, setCategory] = useState<string>('')
  const [leaderId, setLeaderId] = useState<string>('')
  const [vendorName, setVendorName] = useState<string>('')

  /**
   * Upload e parse do arquivo XML
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

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
            vendorName: vendorName || 'Não especificado'
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao importar projeto')
      }

      const result = await response.json()
      alert(`Projeto importado com sucesso! ID: ${result.projectId}`)
      
      // Reset
      setFile(null)
      setPreview(null)
      setStep('upload')
      setCategory('')
      setLeaderId('')
      setVendorName('')
      
      onImportComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Importar MS Project</h1>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".xml"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            📁 Selecionar Arquivo XML
          </label>
          <p className="mt-4 text-gray-600">
            Apenas arquivos .xml do MS Project 2016+
          </p>
          {loading && (
            <p className="mt-4 text-blue-600">⏳ Processando arquivo...</p>
          )}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
              ❌ {error}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 'preview' && preview && (
        <div className="space-y-6">
          {/* Info do Projeto */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">📊 Informações do Projeto</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Código:</span>
                <p className="font-semibold">{preview.project.code}</p>
              </div>
              <div>
                <span className="text-gray-600">Nome:</span>
                <p className="font-semibold">{preview.project.name}</p>
              </div>
              <div>
                <span className="text-gray-600">Data Início:</span>
                <p className="font-semibold">
                  {preview.project.startDate.toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Data Fim:</span>
                <p className="font-semibold">
                  {preview.project.endDate.toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Total de Tarefas:</span>
                <p className="font-semibold">{preview.project.totalTasks}</p>
              </div>
              <div>
                <span className="text-gray-600">Duração:</span>
                <p className="font-semibold">{preview.project.totalDuration} dias</p>
              </div>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">📈 Estatísticas</h2>
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

          {/* Botões */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setStep('upload')
                setFile(null)
                setPreview(null)
              }}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
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
            <h2 className="text-xl font-bold mb-4">📝 Informações Adicionais</h2>
            
            <div className="space-y-4">
              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium mb-2">
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

              {/* Vendedor */}
              <div>
                <label className="block text-sm font-medium mb-2">
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
                <label className="block text-sm font-medium mb-2">
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
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
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
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              ❌ {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}