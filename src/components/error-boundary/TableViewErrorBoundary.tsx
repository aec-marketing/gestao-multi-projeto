'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logError, ErrorContext } from '@/utils/errorHandler'

interface Props {
  children: ReactNode
  onRefresh?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class TableViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, 'TableViewErrorBoundary')

    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })

    if (this.props.onRefresh) {
      this.props.onRefresh()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-lg border border-red-200 p-8">
          <div className="max-w-2xl mx-auto text-center">
            {/* Ícone de erro */}
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Título */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Erro na Visualização de Tabela
            </h2>

            {/* Mensagem */}
            <p className="text-gray-600 mb-6">
              Ocorreu um erro ao renderizar a tabela de tarefas. Isso pode ser causado por dados inconsistentes ou problemas temporários.
            </p>

            {/* Detalhes do erro (somente em desenvolvimento) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                <p className="text-sm font-mono text-red-800 mb-2">
                  <strong>Erro:</strong> {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs font-mono text-red-700">
                    <summary className="cursor-pointer hover:text-red-900 font-semibold">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 overflow-auto max-h-40 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                🔄 Tentar Novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                ↻ Recarregar Página
              </button>
            </div>

            {/* Dica */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 Dica:</strong> Se o problema persistir, tente:
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• Verificar se há tarefas com dados inconsistentes</li>
                <li>• Sincronizar as datas das tarefas pai</li>
                <li>• Verificar conflitos de predecessores</li>
                <li>• Entrar em contato com o suporte técnico</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default TableViewErrorBoundary
