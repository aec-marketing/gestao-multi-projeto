'use client'
import React from 'react'  // ← ADICIONE ESTA LINHA

import { useState } from 'react'
import { Project, Task, Resource } from '@/types/database.types'
import { Allocation } from '@/types/allocation.types'
import { supabase } from '@/lib/supabase'

// Função para obter cores das tarefas (igual ao Gantt)
function getTaskColors(type: string, isSubtask: boolean) {
  const colors: Record<string, { main: string; pastel: string }> = {
    'projeto_mecanico': { 
      main: 'bg-blue-500 text-white', 
      pastel: 'bg-blue-100 text-blue-800' 
    },
    'compras_mecanica': { 
      main: 'bg-purple-500 text-white', 
      pastel: 'bg-purple-100 text-purple-800' 
    },
    'projeto_eletrico': { 
      main: 'bg-yellow-500 text-white', 
      pastel: 'bg-yellow-100 text-yellow-800' 
    },
    'compras_eletrica': { 
      main: 'bg-orange-500 text-white', 
      pastel: 'bg-orange-100 text-orange-800' 
    },
    'fabricacao': { 
      main: 'bg-green-500 text-white', 
      pastel: 'bg-green-100 text-green-800' 
    },
    'tratamento_superficial': { 
      main: 'bg-pink-500 text-white', 
      pastel: 'bg-pink-100 text-pink-800' 
    },
    'montagem_mecanica': { 
      main: 'bg-indigo-500 text-white', 
      pastel: 'bg-indigo-100 text-indigo-800' 
    },
    'montagem_eletrica': { 
      main: 'bg-red-500 text-white', 
      pastel: 'bg-red-100 text-red-800' 
    },
    'coleta': { 
      main: 'bg-teal-500 text-white', 
      pastel: 'bg-teal-100 text-teal-800' 
    }
  }
  
  const taskColors = colors[type] || { 
    main: 'bg-gray-500 text-white', 
    pastel: 'bg-gray-100 text-gray-800' 
  }
  
  return isSubtask ? taskColors.pastel : taskColors.main
}

interface TableViewTabProps {
  project: Project
  tasks: Task[]
  resources: Resource[]
  allocations: Allocation[]
  onRefresh: () => void
}

export default function TableViewTab({
  project,
  tasks,
  resources,
  allocations,
  onRefresh
}: TableViewTabProps) {
  const [editingCell, setEditingCell] = useState<{
    taskId: string
    field: string
  } | null>(null)

// ADICIONE ESTES STATES:
const [isAddingTask, setIsAddingTask] = useState(false)
const [newTaskData, setNewTaskData] = useState({
  name: '',
  type: 'projeto_mecanico',
  duration: 1
})
// ADICIONE ESTES STATES:
const [addingSubtaskToTask, setAddingSubtaskToTask] = useState<string | null>(null)
const [newSubtaskData, setNewSubtaskData] = useState({
  name: '',
  duration: 1
})
// ADICIONE ESTA FUNÇÃO:
async function updateTask(taskId: string, field: string, value: string | number) {
  try {
    const updates: any = {}
    
    // Determinar qual campo atualizar
    if (field === 'name') {
      updates.name = value
    } else if (field === 'duration') {
      updates.duration = parseFloat(value as string)
    } else if (field === 'start_date') {
      updates.start_date = value || null
    } else if (field === 'end_date') {
      updates.end_date = value || null
    } else if (field === 'estimated_cost') {
      updates.estimated_cost = value ? parseFloat(value as string) : 0
    } else if (field === 'actual_cost') {
      updates.actual_cost = value ? parseFloat(value as string) : 0
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)

    if (error) throw error
    
    // Atualizar lista
    onRefresh()
  } catch (error) {
    console.error('Erro ao salvar tarefa:', error)
    alert('Erro ao salvar alterações')
  }
}
async function createNewTask() {
  if (!newTaskData.name.trim()) {
    alert('Nome da tarefa é obrigatório')
    return
  }

  try {
    // Pegar o maior sort_order atual
    const maxSortOrder = Math.max(...tasks.map(t => t.sort_order || 0), 0)

    const { error } = await supabase
      .from('tasks')
      .insert({
        project_id: project.id,
        name: newTaskData.name,
        type: newTaskData.type,
        duration: newTaskData.duration,
        progress: 0,
        sort_order: maxSortOrder + 1,
        parent_id: null
      })

    if (error) throw error

    // Resetar form
    setNewTaskData({ name: '', type: 'projeto_mecanico', duration: 1 })
    setIsAddingTask(false)
    onRefresh()
  } catch (error) {
    console.error('Erro ao criar tarefa:', error)
    alert('Erro ao criar tarefa')
  }
}

function cancelNewTask() {
  setNewTaskData({ name: '', type: 'projeto_mecanico', duration: 1 })
  setIsAddingTask(false)
}
async function createNewSubtask(parentTaskId: string, parentType: string) {
  if (!newSubtaskData.name.trim()) {
    alert('Nome da subtarefa é obrigatório')
    return
  }

  try {
    // Pegar o maior sort_order das subtarefas deste pai
    const siblings = tasks.filter(t => t.parent_id === parentTaskId)
    const maxSortOrder = Math.max(...siblings.map(t => t.sort_order || 0), 0)

    const { error } = await supabase
      .from('tasks')
      .insert({
        project_id: project.id,
        parent_id: parentTaskId,
        name: newSubtaskData.name,
        type: 'subtarefa', // Subtarefas têm type fixo
        duration: newSubtaskData.duration,
        progress: 0,
        sort_order: maxSortOrder + 1
      })

    if (error) throw error

    // Resetar form
    setNewSubtaskData({ name: '', duration: 1 })
    setAddingSubtaskToTask(null)
    onRefresh()
  } catch (error) {
    console.error('Erro ao criar subtarefa:', error)
    alert('Erro ao criar subtarefa')
  }
}

function cancelNewSubtask() {
  setNewSubtaskData({ name: '', duration: 1 })
  setAddingSubtaskToTask(null)
}
async function deleteTask(taskId: string, taskName: string, hasSubtasks: boolean) {
  // Verificar se tem subtarefas
  if (hasSubtasks) {
    const confirmMsg = `A tarefa "${taskName}" possui subtarefas. Deseja excluir a tarefa e todas as suas subtarefas?`
    if (!confirm(confirmMsg)) return
  } else {
    if (!confirm(`Tem certeza que deseja excluir a tarefa "${taskName}"?`)) return
  }

  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) throw error
    
    onRefresh()
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error)
    alert('Erro ao excluir tarefa')
  }
}

async function deleteSubtask(subtaskId: string, subtaskName: string) {
  if (!confirm(`Tem certeza que deseja excluir a subtarefa "${subtaskName}"?`)) return

  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', subtaskId)

    if (error) throw error
    
    onRefresh()
  } catch (error) {
    console.error('Erro ao excluir subtarefa:', error)
    alert('Erro ao excluir subtarefa')
  }
}

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Modo Planilha</h2>
        <p className="text-sm text-gray-600">
          Clique duplo para editar • Enter para salvar • Esc para cancelar
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Tarefa
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Duração
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
<th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
  Custo Real
</th>
<th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
  Ações
</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.filter(t => !t.parent_id).map((task) => {
              const taskAllocations = allocations.filter(a => a.task_id === task.id)
              const subtasks = tasks.filter(t => t.parent_id === task.id)
              const totalEstimatedCost = subtasks.reduce((sum, sub) => sum + (sub.estimated_cost || 0), 0)
    const totalActualCost = subtasks.reduce((sum, sub) => sum + (sub.actual_cost || 0), 0)
              return (
                <React.Fragment key={task.id}>
                  <tr className={`hover:opacity-90 transition-all ${getTaskColors(task.type, false)}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {task.parent_id && (
                          <span className="text-gray-400 mr-2">└</span>
                        )}
                        <input
                          type="text"
                          defaultValue={task.name}
                          className="border-0 bg-white text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 w-full"
                          onDoubleClick={(e) => e.currentTarget.select()}
                          onBlur={(e) => updateTask(task.id, 'name', e.target.value)}

                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {task.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="number"
                        defaultValue={task.duration}
                        className="border border-gray-300 rounded px-2 py-1 w-20 text-sm text-gray-900 bg-white"
                        onDoubleClick={(e) => e.currentTarget.select()}
                          onBlur={(e) => updateTask(task.id, 'duration', e.target.value)}

                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="date"
                        defaultValue={task.start_date || ''}
                        className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
                        onBlur={(e) => updateTask(task.id, 'start_date', e.target.value)}

                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="date"
                        defaultValue={task.end_date || ''}
                        className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
                        onBlur={(e) => updateTask(task.id, 'end_date', e.target.value)}

                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {taskAllocations.map(alloc => {
                          const resource = resources.find(r => r.id === alloc.resource_id)
                          return (
                            <span
                              key={alloc.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700"
                            >
                              {resource?.name || 'N/A'}
                            </span>
                          )
                        })}
                        <button className="text-xs text-blue-600 hover:text-blue-700">
                          + Adicionar
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-10 text-right">
                          {task.progress}%
                        </span>
                      </div>
                    </td>

{/* Custo Estimado - Soma das subtarefas */}
<td className="px-4 py-3 whitespace-nowrap">
  {subtasks.length > 0 ? (
    // Se tem subtarefas, mostrar soma (não editável)
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">R$</span>
      <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded">
        {totalEstimatedCost.toFixed(2).replace('.', ',')}
      </span>
      <span className="text-xs text-gray-400" title="Soma das subtarefas">
        (Σ)
      </span>
    </div>
  ) : (
    // Se não tem subtarefas, input editável
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">R$</span>
      <input
        type="number"
        defaultValue={task.estimated_cost || ''}
        placeholder="0,00"
        className="border border-gray-300 rounded px-2 py-1 w-24 text-sm text-gray-900 bg-white"
        step="0.01"
        min="0"
        onBlur={(e) => updateTask(task.id, 'estimated_cost', e.target.value)}
      />
    </div>
  )}
</td>

{/* Custo Real - Soma das subtarefas */}
<td className="px-4 py-3 whitespace-nowrap">
  {subtasks.length > 0 ? (
    // Se tem subtarefas, mostrar soma (não editável)
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">R$</span>
      <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded">
        {totalActualCost.toFixed(2).replace('.', ',')}
      </span>
      <span className="text-xs text-gray-400" title="Soma das subtarefas">
        (Σ)
      </span>
    </div>
  ) : (
    // Se não tem subtarefas, input editável
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">R$</span>
      <input
        type="number"
        defaultValue={task.actual_cost || ''}
        placeholder="0,00"
        className="border border-gray-300 rounded px-2 py-1 w-24 text-sm text-gray-900 bg-white"
        step="0.01"
        min="0"
        onBlur={(e) => updateTask(task.id, 'actual_cost', e.target.value)}
      />
    </div>
  )}
</td>

                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
  <button
    onClick={() => setAddingSubtaskToTask(task.id)}
    className="text-green-600 hover:text-green-700 mr-2"
    title="Adicionar Subtarefa"
  >
    ➕
  </button>
  <button className="text-blue-600 hover:text-blue-700 mr-2">
    ✏️
  </button>
  <button
  onClick={() => deleteTask(task.id, task.name, subtasks.length > 0)}
  className="text-red-600 hover:text-red-700"
  title="Excluir Tarefa"
>
  🗑️
</button>
</td>
                  </tr>
                  {subtasks.map((subtask: Task) => {
                    const colorType = subtask.type === 'subtarefa' ? task.type : subtask.type
                    return (
                      <tr key={subtask.id} className={`hover:opacity-90 transition-all ${getTaskColors(colorType, true)}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-gray-400 mr-2">└</span>
                            <input
                              type="text"
                              defaultValue={subtask.name}
                              className="border-0 bg-transparent text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 w-full"
                              onDoubleClick={(e) => e.currentTarget.select()}
                              onBlur={(e) => updateTask(subtask.id, 'name', e.target.value)}

                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {subtask.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            defaultValue={subtask.duration}
                            className="border border-gray-300 rounded px-2 py-1 w-20 text-sm text-gray-900 bg-white"
                            onDoubleClick={(e) => e.currentTarget.select()}
                            onBlur={(e) => updateTask(subtask.id, 'duration', e.target.value)}

                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={subtask.start_date || ''}
                            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
                            onBlur={(e) => updateTask(subtask.id, 'start_date', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={subtask.end_date || ''}
                            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
                            onBlur={(e) => updateTask(subtask.id, 'end_date', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {taskAllocations.map(alloc => {
                              const resource = resources.find(r => r.id === alloc.resource_id)
                              return (
                                <span
                                  key={alloc.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700"
                                >
                                  {resource?.name || 'N/A'}
                                </span>
                              )
                            })}
                            <button className="text-xs text-blue-600 hover:text-blue-700">
                              + Adicionar
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${subtask.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-10 text-right">
                              {subtask.progress}%
                            </span>
                          </div>
                        </td>

                        {/* Custo Estimado */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">R$</span>
                            <input
                              type="number"
                              defaultValue={subtask.estimated_cost || ''}
                              placeholder="0,00"
                              className="border border-gray-300 rounded px-2 py-1 w-24 text-sm text-gray-900 bg-white"
                              step="0.01"
                              min="0"
                              onBlur={(e) => updateTask(subtask.id, 'estimated_cost', e.target.value)}
                            />
                          </div>
                        </td>

                        {/* Custo Real */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">R$</span>
                            <input
                              type="number"
                              defaultValue={subtask.actual_cost || ''}
                              placeholder="0,00"
                              className="border border-gray-300 rounded px-2 py-1 w-24 text-sm text-gray-900 bg-white"
                              step="0.01"
                              min="0"
                              onBlur={(e) => updateTask(subtask.id, 'actual_cost', e.target.value)}
                            />
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          <button className="text-blue-600 hover:text-blue-700 mr-2">
                            ✏️
                          </button>
                          <button
  onClick={() => deleteSubtask(subtask.id, subtask.name)}
  className="text-red-600 hover:text-red-700"
  title="Excluir Subtarefa"
>
  🗑️
</button>
                        </td>
                      </tr>
                    )
                                  })}
                
                {/* ADICIONE ESTA LINHA - Nova subtarefa */}
                {addingSubtaskToTask === task.id && (
                  <tr className="bg-green-50 border-2 border-green-500">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-gray-400 mr-2">└</span>
                        <input
                          type="text"
                          placeholder="Nome da subtarefa..."
                          value={newSubtaskData.name}
                          onChange={(e) => setNewSubtaskData({ ...newSubtaskData, name: e.target.value })}
                          className="border border-green-500 rounded px-2 py-1 w-full text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') createNewSubtask(task.id, task.type)
                            if (e.key === 'Escape') cancelNewSubtask()
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600">subtarefa</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="number"
                        value={newSubtaskData.duration}
                        onChange={(e) => setNewSubtaskData({ ...newSubtaskData, duration: parseFloat(e.target.value) })}
                        className="border border-gray-300 rounded px-2 py-1 w-20 text-sm text-gray-900 bg-white"
                        min="0.5"
                        step="0.5"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                      <span className="text-xs">Calculado</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                      <span className="text-xs">Calculado</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-400">Nenhuma</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-400">0%</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => createNewSubtask(task.id, task.type)}
                        className="text-green-600 hover:text-green-700 mr-2"
                        title="Salvar (Enter)"
                      >
                        ✅
                      </button>
                      <button
                        onClick={cancelNewSubtask}
                        className="text-red-600 hover:text-red-700"
                        title="Cancelar (Esc)"
                      >
                        ❌
                      </button>
                    </td>
                  </tr>
                )}
                
              </React.Fragment>
              )
            })}
            
            {/* ADICIONE ESTA LINHA - Nova tarefa */}
            {isAddingTask && (
              <tr className="bg-green-50 border-2 border-green-500">
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="text"
                    placeholder="Nome da tarefa..."
                    value={newTaskData.name}
                    onChange={(e) => setNewTaskData({ ...newTaskData, name: e.target.value })}
                    className="border border-green-500 rounded px-2 py-1 w-full text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createNewTask()
                      if (e.key === 'Escape') cancelNewTask()
                    }}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <select
                    value={newTaskData.type}
                    onChange={(e) => setNewTaskData({ ...newTaskData, type: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
                  >
                    <option value="projeto_mecanico">Projeto Mecânico</option>
                    <option value="compras_mecanica">Compras Mecânica</option>
                    <option value="projeto_eletrico">Projeto Elétrico</option>
                    <option value="compras_eletrica">Compras Elétrica</option>
                    <option value="fabricacao">Fabricação</option>
                    <option value="tratamento_superficial">Tratamento Superficial</option>
                    <option value="montagem_mecanica">Montagem Mecânica</option>
                    <option value="montagem_eletrica">Montagem Elétrica</option>
                    <option value="coleta">Coleta</option>
                  </select>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="number"
                    value={newTaskData.duration}
                    onChange={(e) => setNewTaskData({ ...newTaskData, duration: parseFloat(e.target.value) })}
                    className="border border-gray-300 rounded px-2 py-1 w-20 text-sm text-gray-900 bg-white"
                    min="0.5"
                    step="0.5"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                  <span className="text-xs">Calculado</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                  <span className="text-xs">Calculado</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-xs text-gray-400">Nenhuma</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-xs text-gray-400">0%</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={createNewTask}
                    className="text-green-600 hover:text-green-700 mr-2"
                    title="Salvar (Enter)"
                  >
                    ✅
                  </button>
                  <button
                    onClick={cancelNewTask}
                    className="text-red-600 hover:text-red-700"
                    title="Cancelar (Esc)"
                  >
                    ❌
                  </button>
                </td>
              </tr>
            )}</tbody>
        </table>
      </div>

      {/* Adicionar nova tarefa */}
      <div className="p-4 border-t bg-gray-50">
  <button
    onClick={() => setIsAddingTask(true)}
    disabled={isAddingTask}
    className={`text-sm font-medium ${
      isAddingTask
        ? 'text-gray-400 cursor-not-allowed'
        : 'text-blue-600 hover:text-blue-700'
    }`}
  >
    {isAddingTask ? '✏️ Editando...' : '+ Adicionar Nova Tarefa'}
  </button>
  {isAddingTask && (
    <span className="text-xs text-gray-500 ml-3">
      Enter para salvar • Esc para cancelar
    </span>
  )}
</div>
    </div>
  )
}