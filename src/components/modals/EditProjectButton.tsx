'use client'

import { useState } from 'react'
import { Edit3 } from 'lucide-react'
import { Project, Task } from '@/types/database.types'
import EditProjectModal from './EditProjectModal'

interface EditProjectButtonProps {
  project: Project
  tasks: Task[]
  onRefresh: () => void
}

export default function EditProjectButton({ project, tasks, onRefresh }: EditProjectButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        <Edit3 className="w-4 h-4" />
        Editar Projeto
      </button>

      {isOpen && (
        <EditProjectModal
          project={project}
          tasks={tasks}
          onClose={() => setIsOpen(false)}
          onSave={onRefresh}
        />
      )}
    </>
  )
}
