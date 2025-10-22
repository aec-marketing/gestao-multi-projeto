interface StatsCardProps {
  title: string
  value: string | number
  description: string
  icon: string
  color: 'blue' | 'green' | 'purple' | 'yellow' | 'red'
}

export default function StatsCard({ title, value, description, icon, color }: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800'
  }

  const iconColorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600'
  }

  return (
    <div className={`p-6 rounded-lg border shadow-sm ${colorClasses[color]} min-h-[140px]`}>
      <div className="flex items-start justify-between h-full">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium opacity-90 mb-1 truncate">{title}</p>
          <p className="text-3xl font-bold mb-2 leading-none">{value}</p>
          <p className="text-sm opacity-75 leading-tight">{description}</p>
        </div>
        <div className={`text-3xl ml-3 flex-shrink-0 ${iconColorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}