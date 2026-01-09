'use client'

interface ResourceGroupHeaderProps {
  role: 'gerente' | 'lider' | 'operador'
  count: number
  isExpanded: boolean
  onToggle: () => void
}

/**
 * Collapsible header for resource groups (Gerente, Líder, Operador)
 */
export default function ResourceGroupHeader({
  role,
  count,
  isExpanded,
  onToggle,
}: ResourceGroupHeaderProps) {
  const roleConfig = {
    gerente: {
      label: 'Gerentes',
      icon: '👔',
      color: 'bg-purple-50 border-purple-300 text-purple-900',
    },
    lider: {
      label: 'Líderes',
      icon: '👨‍💼',
      color: 'bg-blue-50 border-blue-300 text-blue-900',
    },
    operador: {
      label: 'Operadores',
      icon: '👷',
      color: 'bg-gray-50 border-gray-300 text-gray-900',
    },
  }

  const config = roleConfig[role]

  return (
    <button
      onClick={onToggle}
      className={`
        w-full flex items-center justify-between p-3 border-b border-t
        ${config.color}
        hover:bg-opacity-70 transition-all cursor-pointer
      `}
    >
      <div className="flex items-center gap-2">
        {/* Expand/collapse icon */}
        <span className="text-gray-600 font-bold">
          {isExpanded ? '▼' : '▶'}
        </span>

        {/* Role icon */}
        <span className="text-lg">{config.icon}</span>

        {/* Role label */}
        <span className="font-semibold">{config.label}</span>

        {/* Count badge */}
        <span className="bg-white bg-opacity-70 px-2 py-0.5 rounded-full text-xs font-medium">
          {count}
        </span>
      </div>

      {/* Helper text */}
      <span className="text-xs text-gray-600">
        {isExpanded ? 'Clique para ocultar' : 'Clique para expandir'}
      </span>
    </button>
  )
}
