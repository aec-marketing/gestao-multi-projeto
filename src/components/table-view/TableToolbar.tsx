import React from 'react'

interface TableToolbarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  sortBy: string
  onSortByChange: (value: any) => void
  sortOrder: 'asc' | 'desc'
  onToggleSortOrder: () => void
  resultCount: number
  onAddTask: () => void
  isAddingTask: boolean
}

/**
 * Toolbar da tabela com busca, filtros e ações
 */
export const TableToolbar = React.memo(function TableToolbar({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onToggleSortOrder,
  resultCount,
  onAddTask,
  isAddingTask
}: TableToolbarProps) {
  return (
    <div className="p-6 border-b space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Modo Planilha</h2>
        <p className="text-sm text-gray-600">
          Edite diretamente nas células • Mudanças são salvas em lote
        </p>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="🔍 Buscar por nome ou tipo..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Ordenar:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Nome</option>
            <option value="type">Tipo</option>
            <option value="duration">Duração</option>
            <option value="progress">Progresso</option>
          </select>

          <button
            onClick={onToggleSortOrder}
            className="p-2 border border-gray-300 rounded hover:bg-gray-50 bg-white text-gray-700 transition-colors"
            title={sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {searchTerm && (
          <div className="text-sm text-gray-600">
            {resultCount} resultado(s)
          </div>
        )}
      </div>

      {/* Add task button */}
      {!searchTerm && (
        <button
          onClick={onAddTask}
          disabled={isAddingTask}
          className={`text-sm font-medium transition-colors ${
            isAddingTask
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-blue-600 hover:text-blue-700'
          }`}
        >
          {isAddingTask ? '✏️ Editando...' : '+ Adicionar Nova Tarefa'}
        </button>
      )}
    </div>
  )
})
