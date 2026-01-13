'use client'

import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Ícone */}
      {icon && (
        <div className="mb-4 text-gray-400">
          {icon}
        </div>
      )}

      {/* Título */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>

      {/* Descrição */}
      <p className="text-sm text-gray-600 text-center max-w-md mb-6">
        {description}
      </p>

      {/* Ação */}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export default EmptyState
