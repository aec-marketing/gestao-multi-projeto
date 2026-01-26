import React from 'react'

/**
 * Header da tabela com nomes das colunas
 */
export const TableHeader = React.memo(function TableHeader() {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          WBS
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Tarefa
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Tipo
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Categoria
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Duração (dias)
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Início
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Fim
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Pessoas
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Progresso
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Custo Est.
        </th>
        <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider" title="Custo real baseado em recursos alocados (comparado com estimado)">
          Custo Real 💰
        </th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
          Ações
        </th>
      </tr>
    </thead>
  )
})
