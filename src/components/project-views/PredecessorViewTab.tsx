'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Project, Task } from '@/types/database.types'
import AddPredecessorModal from '@/components/modals/AddPredecessorModal'
import EditPredecessorModal from '@/components/modals/EditPredecessorModal'
import RecalculateModal from '@/components/modals/RecalculateModal'

// ============ TYPES ============
interface Predecessor {
  id: string
  task_id: string
  predecessor_id: string
  type: string
  lag_time: number
  created_at: string
}

interface TaskWithPredecessors {
  task: Task
  predecessors: Array<{
    predecessor: Predecessor
    predecessorTask: Task
  }>
  successors: Array<{
    successor: Predecessor
    successorTask: Task
  }>
}

// ============ INTERFACE ============
interface PredecessorViewTabProps {
  project: Project
  tasks: Task[]
  onRefresh: () => void
}

// ============ UTILS ============
function getPredecessorTypeLabel(type: string): string {
  const labels: Record<string, { name: string; icon: string }> = {
    'FS': { name: 'Fim-Início', icon: '→' },
    'fim_inicio': { name: 'Fim-Início', icon: '→' },
    'SS': { name: 'Início-Início', icon: '⇒' },
    'inicio_inicio': { name: 'Início-Início', icon: '⇒' },
    'FF': { name: 'Fim-Fim', icon: '←' },
    'fim_fim': { name: 'Fim-Fim', icon: '←' },
    'SF': { name: 'Início-Fim', icon: '↔' },
    'inicio_fim': { name: 'Início-Fim', icon: '↔' }
  }
  return `${labels[type]?.icon || '?'} ${labels[type]?.name || type}`
}

function formatLagTime(lag: number): string {
  if (lag === 0) return '0 dias'
  if (lag === 0.5) return '+0.5 dia'
  if (lag === 1) return '+1 dia'
  if (lag > 1) return `+${lag} dias`
  if (lag < 0) return `${lag} dias (sobreposição)`
  return `+${lag} dias`
}

function getTaskTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'projeto_mecanico': 'bg-blue-100 text-blue-800',
    'compras_mecanica': 'bg-purple-100 text-purple-800',
    'projeto_eletrico': 'bg-yellow-100 text-yellow-800',
    'compras_eletrica': 'bg-orange-100 text-orange-800',
    'fabricacao': 'bg-green-100 text-green-800',
    'tratamento_superficial': 'bg-pink-100 text-pink-800',
    'montagem_mecanica': 'bg-indigo-100 text-indigo-800',
    'montagem_eletrica': 'bg-red-100 text-red-800',
    'coleta': 'bg-teal-100 text-teal-800',
    'subtarefa': 'bg-gray-100 text-gray-800'
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

function formatTaskType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ============ COMPONENT ============
export default function PredecessorViewTab({
  project,
  tasks,
  onRefresh
}: PredecessorViewTabProps) {
  const [predecessors, setPredecessors] = useState<Predecessor[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<'all' | 'with' | 'without'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'dependencies'>('name')
// ========== NOVO: Modal e formulário ==========
const [showAddModal, setShowAddModal] = useState(false)
const [selectedTaskForPredecessor, setSelectedTaskForPredecessor] = useState<Task | null>(null)
const [showEditModal, setShowEditModal] = useState(false)
const [editingPredecessor, setEditingPredecessor] = useState<any>(null)
const [showRecalculateModal, setShowRecalculateModal] = useState(false)
const [pendingUpdates, setPendingUpdates] = useState<any[]>([])
// ========== FIM NOVO ==========
  // ============ LOAD PREDECESSORS ============
  useEffect(() => {
    loadPredecessors()
  }, [project.id])

  async function loadPredecessors() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('predecessors')
        .select('*')
      
      if (error) throw error
      
      // Filtrar predecessores que pertencem a tarefas deste projeto
      const projectTaskIds = new Set(tasks.map(t => t.id))
      const filtered = (data || []).filter(p => 
        projectTaskIds.has(p.task_id)
      )
      
      setPredecessors(filtered as Predecessor[])
    } catch (error) {
      setPredecessors([])
    } finally {
      setLoading(false)
    }
  }
// ========== NOVO: Função auxiliar ==========
function getExistingPredecessorPairs() {
  return predecessors.map(p => ({
    task_id: p.task_id,
    predecessor_id: p.predecessor_id
  }))
}

// ========== FIM NOVO ==========
// Adicionar após getExistingPredecessorPairs()
async function handleDeletePredecessor(predecessorId: string) {
  if (!confirm('Tem certeza que deseja remover esta dependência?')) {
    return
  }

  const { error } = await supabase
    .from('predecessors')
    .delete()
    .eq('id', predecessorId)

  if (error) {
    alert('Erro ao deletar predecessor')
    return
  }

  loadPredecessors()
  onRefresh()
}
  // ============ ORGANIZE DATA ============
  function getTaskPredecessors(taskId: string): TaskWithPredecessors | null {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return null

    // Predecessores desta tarefa (tarefas que ela depende)
    const predecessorRelations = predecessors.filter(p => p.task_id === taskId)
    const taskPredecessors = predecessorRelations.map(rel => {
      const predTask = tasks.find(t => t.id === rel.predecessor_id)
      return {
        predecessor: rel,
        predecessorTask: predTask!
      }
    }).filter(p => p.predecessorTask)

    // Sucessores desta tarefa (tarefas que dependem dela)
    const successorRelations = predecessors.filter(p => p.predecessor_id === taskId)
    const taskSuccessors = successorRelations.map(rel => {
      const succTask = tasks.find(t => t.id === rel.task_id)
      return {
        successor: rel,
        successorTask: succTask!
      }
    }).filter(s => s.successorTask)

    return {
      task,
      predecessors: taskPredecessors,
      successors: taskSuccessors
    }
  }

  // ============ FILTER & SORT ============
  const mainTasks = tasks.filter(t => !t.parent_id)

  let filteredTasks = mainTasks
    .map(t => getTaskPredecessors(t.id))
    .filter(t => t !== null) as TaskWithPredecessors[]

  // Aplicar filtro
  if (filterMode === 'with') {
    filteredTasks = filteredTasks.filter(t =>
      t.predecessors.length > 0 || t.successors.length > 0
    )
  } else if (filterMode === 'without') {
    filteredTasks = filteredTasks.filter(t =>
      t.predecessors.length === 0 && t.successors.length === 0
    )
  }

  // Aplicar ordenação
  if (sortBy === 'dependencies') {
    filteredTasks.sort((a, b) => {
      const aCount = a.predecessors.length + a.successors.length
      const bCount = b.predecessors.length + b.successors.length
      return bCount - aCount // Descendente (mais dependências primeiro)
    })
  } else {
    filteredTasks.sort((a, b) => a.task.name.localeCompare(b.task.name))
  }

  // ========== COMPONENTE RECURSIVO PARA RENDERIZAR TAREFA COM PREDECESSORES ==========
  interface TaskPredecessorRowProps {
    task: Task
    level: number
    allTasks: Task[]
    predecessors: Predecessor[]
    onAddPredecessor: (task: Task) => void
    onEditPredecessor: (pred: Predecessor) => void
    onDeletePredecessor: (predId: string) => void
  }

  const TaskPredecessorRow: React.FC<TaskPredecessorRowProps> = ({
    task,
    level,
    allTasks,
    predecessors,
    onAddPredecessor,
    onEditPredecessor,
    onDeletePredecessor
  }) => {
    // Buscar subtarefas DIRETAS
    const subtasks = allTasks.filter(t => t.parent_id === task.id)
    const hasSubtasks = subtasks.length > 0

    // Calcular indentação baseado em outline_level
    const indentLevel = task.outline_level || level
    const indent = indentLevel * 30 // 30px por nível

    // Buscar predecessores desta tarefa
    const taskPredecessors = predecessors
      .filter(p => p.task_id === task.id)
      .map(p => {
        const predTask = allTasks.find(t => t.id === p.predecessor_id)
        return {
          predecessor: p,
          predecessorTask: predTask
        }
      })
      .filter(rel => rel.predecessorTask) // Garantir que encontrou a tarefa

    // Buscar sucessores (tarefas que dependem desta)
    const taskSuccessors = predecessors
      .filter(p => p.predecessor_id === task.id)
      .map(p => {
        const succTask = allTasks.find(t => t.id === p.task_id)
        return {
          successor: p,
          successorTask: succTask
        }
      })
      .filter(rel => rel.successorTask)

    return (
      <>
        {/* Card da Tarefa */}
        <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow mb-4">
          {/* Cabeçalho da Tarefa */}
          <div
            className="flex items-start justify-between mb-3"
            style={{ paddingLeft: `${indent}px` }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {level > 0 && <span className="text-gray-400">└─</span>}

                {/* WBS Code */}
                {task.wbs_code && (
                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {task.wbs_code}
                  </span>
                )}

                {/* Nome da Tarefa */}
                <h3 className={`font-semibold ${hasSubtasks ? 'text-lg text-gray-900' : 'text-base text-gray-800'}`}>
                  {task.name}
                </h3>

                {/* Badge de Tipo */}
                <span className={`text-xs px-2 py-0.5 rounded ${getTaskTypeColor(task.type)}`}>
                  {formatTaskType(task.type)}
                </span>
              </div>

              {/* Info Secundária */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>📅 {task.start_date ? new Date(task.start_date).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                <span>⏱️ {task.duration} {task.duration === 1 ? 'dia' : 'dias'}</span>
                <span>📊 {task.progress}%</span>
              </div>
            </div>

            {/* Botão Adicionar Predecessor */}
            <button
              onClick={() => onAddPredecessor(task)}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              ➕ Adicionar
            </button>
          </div>

          {/* Grid de Predecessores e Sucessores */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            style={{ paddingLeft: `${indent}px` }}
          >
            {/* Predecessores (tarefas das quais esta depende) */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                📥 Depende de ({taskPredecessors.length}):
              </h4>

              {taskPredecessors.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhuma dependência</p>
              ) : (
                <ul className="space-y-2">
                  {taskPredecessors.map((rel) => (
                    <li
                      key={rel.predecessor.id}
                      className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded p-2"
                    >
                      {/* WBS do Predecessor */}
                      <span className="font-mono text-blue-700 font-bold min-w-[60px]">
                        {rel.predecessorTask!.wbs_code || `#${rel.predecessorTask!.sort_order}`}
                      </span>

                      {/* Nome */}
                      <span className="flex-1 text-gray-900 truncate" title={rel.predecessorTask!.name}>
                        {rel.predecessorTask!.name}
                      </span>

                      {/* Tipo */}
                      <span className="text-blue-600 font-medium whitespace-nowrap">
                        {getPredecessorTypeLabel(rel.predecessor.type)}
                      </span>

                      {/* Lag */}
                      <span className="text-gray-600 whitespace-nowrap">
                        {formatLagTime(rel.predecessor.lag_time)}
                      </span>

                      {/* Ações */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => onEditPredecessor(rel.predecessor)}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          title="Editar predecessor"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onDeletePredecessor(rel.predecessor.id)}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          title="Remover predecessor"
                        >
                          ❌
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sucessores (tarefas que dependem desta) */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                📤 Depende dela ({taskSuccessors.length}):
              </h4>

              {taskSuccessors.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhuma tarefa depende dela</p>
              ) : (
                <ul className="space-y-2">
                  {taskSuccessors.map((rel) => (
                    <li
                      key={rel.successor.id}
                      className="flex items-center gap-2 text-xs bg-green-50 border border-green-200 rounded p-2"
                    >
                      {/* WBS do Sucessor */}
                      <span className="font-mono text-green-700 font-bold min-w-[60px]">
                        {rel.successorTask!.wbs_code || `#${rel.successorTask!.sort_order}`}
                      </span>

                      {/* Nome */}
                      <span className="flex-1 text-gray-900 truncate" title={rel.successorTask!.name}>
                        {rel.successorTask!.name}
                      </span>

                      {/* Tipo */}
                      <span className="text-green-600 font-medium whitespace-nowrap">
                        {getPredecessorTypeLabel(rel.successor.type)}
                      </span>

                      {/* Lag */}
                      <span className="text-gray-600 whitespace-nowrap">
                        {formatLagTime(rel.successor.lag_time)}
                      </span>

                      {/* Info: Não permite editar/deletar via sucessor, só via tarefa que depende */}
                      <span className="text-xs text-gray-400 italic">
                        (editar na tarefa)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* RECURSÃO: Renderizar subtarefas */}
        {subtasks.map(subtask => (
          <TaskPredecessorRow
            key={subtask.id}
            task={subtask}
            level={level + 1}
            allTasks={allTasks}
            predecessors={predecessors}
            onAddPredecessor={onAddPredecessor}
            onEditPredecessor={onEditPredecessor}
            onDeletePredecessor={onDeletePredecessor}
          />
        ))}
      </>
    )
  }

  // ============ RENDER ============
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>🔗 Predecessores e Dependências</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage task dependencies and relationships
            </p>
          </div>
          <button
            onClick={() => {
              loadPredecessors()
              onRefresh()
            }}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="Recarregar dados"
          >
            🔄 Atualizar
          </button>
        </div>

        {/* Filtros e Ordenação */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Filtro */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filtrar:</label>
            <div className="flex gap-1">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterMode('with')}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                  filterMode === 'with'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Com Dependências
              </button>
              <button
                onClick={() => setFilterMode('without')}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                  filterMode === 'without'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Sem Dependências
              </button>
            </div>
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm font-medium text-gray-700">Ordenar:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'dependencies')}
              className="px-3 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Por Nome</option>
              <option value="dependencies">Por Dependências</option>
            </select>
          </div>

          {/* Contador */}
          <div className="text-xs text-gray-600 font-medium ml-auto">
            {filteredTasks.length} tarefa(s)
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">⏳ Carregando predecessores...</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-gray-400 text-2xl mb-2">🔍</div>
              <div className="text-gray-500">Nenhuma tarefa encontrada</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Renderizar tarefas raiz (sem parent_id) usando recursividade */}
            {filteredTasks
              .filter(item => !item.task.parent_id)
              .map((item) => (
                <TaskPredecessorRow
                  key={item.task.id}
                  task={item.task}
                  level={0}
                  allTasks={tasks}
                  predecessors={predecessors}
                  onAddPredecessor={(task) => {
                    setSelectedTaskForPredecessor(task)
                    setShowAddModal(true)
                  }}
                  onEditPredecessor={(pred) => {
                    setEditingPredecessor(pred)
                    setShowEditModal(true)
                  }}
                  onDeletePredecessor={handleDeletePredecessor}
                />
              ))}
          </div>
        )}
      </div>

      {/* Modais (fora do loop de renderização) */}
      {/* ========== Modal de Adicionar Predecessor ========== */}
      <AddPredecessorModal
        isOpen={showAddModal}
        task={selectedTaskForPredecessor}
        allTasks={tasks}
        existingPredecessors={getExistingPredecessorPairs()}
        allPredecessors={predecessors}
        onClose={() => {
          setShowAddModal(false)
          setSelectedTaskForPredecessor(null)
        }}
        onSuccess={() => {
          loadPredecessors()
          onRefresh()
        }}
        onRecalculate={(updates) => {
          setPendingUpdates(updates)
          setShowRecalculateModal(true)
        }}
      />

      {/* Modal de Editar */}
      <EditPredecessorModal
        isOpen={showEditModal}
        predecessor={editingPredecessor}
        allTasks={tasks}
        allPredecessors={predecessors}
        onClose={() => {
          setShowEditModal(false)
          setEditingPredecessor(null)
        }}
        onSuccess={() => {
          loadPredecessors()
          onRefresh()
        }}
        onRecalculate={(updates) => {
          setPendingUpdates(updates)
          setShowRecalculateModal(true)
        }}
      />

      {/* Modal de Recalcular */}
      <RecalculateModal
        isOpen={showRecalculateModal}
        updates={pendingUpdates}
        taskNames={new Map(tasks.map(t => [t.id, t.name]))}
        onClose={() => {
          setShowRecalculateModal(false)
          setPendingUpdates([])
          loadPredecessors()
          onRefresh()
        }}
        onApply={() => {
          setShowRecalculateModal(false)
          setPendingUpdates([])
          loadPredecessors()
          onRefresh()
        }}
      />
      {/* ========== FIM MODAIS ========== */}

      {/* Footer com Info */}
      <div className="px-6 py-4 bg-gray-50 border-t text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <div>
            💡 <strong>Legenda:</strong>
            {' → '}(Fim-Início)
            {' | ⇒ '}(Início-Início)
            {' | ← '}(Fim-Fim)
          </div>
          <div className="text-right">
            Total de Predecessores: <strong>{predecessors.length}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}