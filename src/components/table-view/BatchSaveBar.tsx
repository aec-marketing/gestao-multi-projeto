import React from 'react'

interface BatchSaveBarProps {
  changeCount: number
  onSave: () => void
  onDiscard: () => void
  isSaving: boolean
}

/**
 * Barra sticky bottom para salvar alterações em lote
 * Aparece apenas quando há mudanças pendentes
 */
export const BatchSaveBar = React.memo(function BatchSaveBar({
  changeCount,
  onSave,
  onDiscard,
  isSaving
}: BatchSaveBarProps) {
  if (changeCount === 0) return null

  return (
    <>
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-yellow-50 to-orange-50 border-t-4 border-yellow-400 shadow-2xl z-50 animate-slide-up">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Info */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-yellow-900">
                    {changeCount} alteração{changeCount !== 1 ? 'ões' : ''} não salva{changeCount !== 1 ? 's' : ''}
                  </span>
                  <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-semibold">
                    Pendente
                  </span>
                </div>
                <p className="text-sm text-yellow-800 mt-0.5">
                  Clique em &quot;Salvar Tudo&quot; para aplicar as mudanças
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={onDiscard}
                disabled={isSaving}
                className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Descartar Tudo
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Salvar Tudo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
})
