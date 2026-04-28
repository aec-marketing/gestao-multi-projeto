import * as XLSX from 'xlsx'
import type { Task, Resource } from '@/types/database.types'
import type { Allocation } from '@/types/allocation.types'

const TASK_TYPE_LABELS: Record<string, string> = {
  projeto_mecanico: 'Projeto Mecânico',
  compras_mecanica: 'Compras Mecânica',
  projeto_eletrico: 'Projeto Elétrico',
  compras_eletrica: 'Compras Elétrica',
  fabricacao: 'Fabricação',
  tratamento_superficial: 'Tratamento Superficial',
  montagem_mecanica: 'Montagem Mecânica',
  montagem_eletrica: 'Montagem Elétrica',
  coleta: 'Coleta',
  subtarefa: 'Subtarefa',
  lista_compras: 'Lista de Compras',
  grupo_compras: 'Grupo de Compras',
}

function formatDate(date: string | null): string {
  if (!date) return ''
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function durationInDays(task: Task): number {
  const mins = task.duration_minutes ?? 0
  const divisor = task.work_type === 'wait' ? 1440 : 540
  return Math.round((mins / divisor) * 10) / 10
}

// Replica exatamente a lógica do useTaskCalculations
function buildAllocCostMap(
  allocations: Allocation[],
  allTasks: Task[],
  resources: Resource[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const alloc of allocations) {
    const resource = resources.find(r => r.id === alloc.resource_id)
    const task = allTasks.find(t => t.id === alloc.task_id)
    if (!resource || !task) continue
    const minutes = alloc.allocated_minutes ?? task.duration_minutes ?? 0
    const overtime = alloc.overtime_minutes ?? 0
    const multiplier = alloc.overtime_multiplier ?? 1.5
    const cost = (minutes / 60) * resource.hourly_rate
      + (overtime / 60) * resource.hourly_rate * multiplier
    map.set(alloc.task_id, (map.get(alloc.task_id) ?? 0) + cost)
  }
  return map
}

function calcTotalCost(
  taskId: string,
  allTasks: Task[],
  allocCostMap: Map<string, number>
): number {
  const children = allTasks.filter(t => t.parent_id === taskId)
  if (children.length === 0) {
    const task = allTasks.find(t => t.id === taskId)
    return (task?.estimated_cost ?? 0) + (allocCostMap.get(taskId) ?? 0)
  }
  return children.reduce((sum, child) => sum + calcTotalCost(child.id, allTasks, allocCostMap), 0)
}

interface ExportRow {
  WBS: string
  Tarefa: string
  Tipo: string
  'Duração (dias)': number
  Início: string
  Fim: string
  'Progresso (%)': number
  Responsáveis: string
  Custo: number
  'Caminho Crítico': string
  Notas: string
}

function buildRows(
  allTasks: Task[],
  parentId: string,
  allocations: Allocation[],
  resources: Resource[],
  allocCostMap: Map<string, number>,
  level: number
): ExportRow[] {
  const children = allTasks
    .filter(t => t.parent_id === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const rows: ExportRow[] = []
  const indent = '    '.repeat(level)

  for (const task of children) {
    const responsaveis = allocations
      .filter(a => a.task_id === task.id)
      .map(a => resources.find(r => r.id === a.resource_id)?.name ?? '')
      .filter(Boolean)
      .join(', ')

    rows.push({
      WBS: task.wbs_code ?? '',
      Tarefa: indent + task.name,
      Tipo: TASK_TYPE_LABELS[task.type] ?? task.type,
      'Duração (dias)': durationInDays(task),
      Início: formatDate(task.start_date),
      Fim: formatDate(task.end_date),
      'Progresso (%)': task.progress ?? 0,
      Responsáveis: responsaveis,
      Custo: calcTotalCost(task.id, allTasks, allocCostMap),
      'Caminho Crítico': task.is_critical_path ? 'Sim' : 'Não',
      Notas: task.notes ?? '',
    })

    rows.push(...buildRows(allTasks, task.id, allocations, resources, allocCostMap, level + 1))
  }

  return rows
}

const SHEET_COLS = [
  { wch: 8 },  // WBS
  { wch: 40 }, // Tarefa
  { wch: 22 }, // Tipo
  { wch: 14 }, // Duração
  { wch: 12 }, // Início
  { wch: 12 }, // Fim
  { wch: 12 }, // Progresso
  { wch: 30 }, // Responsáveis
  { wch: 16 }, // Custo
  { wch: 14 }, // Caminho Crítico
  { wch: 30 }, // Notas
]

export function exportTasksToExcel(
  projectName: string,
  selectedTaskIds: string[],
  allTasks: Task[],
  allocations: Allocation[],
  resources: Resource[]
) {
  const allocCostMap = buildAllocCostMap(allocations, allTasks, resources)

  const rootTasks = allTasks
    .filter(t => !t.parent_id && selectedTaskIds.includes(t.id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const wb = XLSX.utils.book_new()

  // Aba Resumo
  const resumoRows = rootTasks.map(task => ({
    WBS: task.wbs_code ?? '',
    Tarefa: task.name,
    Tipo: TASK_TYPE_LABELS[task.type] ?? task.type,
    'Duração (dias)': durationInDays(task),
    Início: formatDate(task.start_date),
    Fim: formatDate(task.end_date),
    'Progresso (%)': task.progress ?? 0,
    Custo: calcTotalCost(task.id, allTasks, allocCostMap),
  }))

  const resumoSheet = XLSX.utils.json_to_sheet(resumoRows)
  resumoSheet['!cols'] = SHEET_COLS.slice(0, 8)
  XLSX.utils.book_append_sheet(wb, resumoSheet, 'Resumo')

  // Uma aba por grupo
  for (const rootTask of rootTasks) {
    const rootRow: ExportRow = {
      WBS: rootTask.wbs_code ?? '',
      Tarefa: rootTask.name,
      Tipo: TASK_TYPE_LABELS[rootTask.type] ?? rootTask.type,
      'Duração (dias)': durationInDays(rootTask),
      Início: formatDate(rootTask.start_date),
      Fim: formatDate(rootTask.end_date),
      'Progresso (%)': rootTask.progress ?? 0,
      Responsáveis: allocations
        .filter(a => a.task_id === rootTask.id)
        .map(a => resources.find(r => r.id === a.resource_id)?.name ?? '')
        .filter(Boolean)
        .join(', '),
      Custo: calcTotalCost(rootTask.id, allTasks, allocCostMap),
      'Caminho Crítico': rootTask.is_critical_path ? 'Sim' : 'Não',
      Notas: rootTask.notes ?? '',
    }

    const children = buildRows(allTasks, rootTask.id, allocations, resources, allocCostMap, 1)
    const ws = XLSX.utils.json_to_sheet([rootRow, ...children])
    ws['!cols'] = SHEET_COLS

    const tabName = `${rootTask.wbs_code ?? ''} ${rootTask.name}`
      .replace(/[\\/:*?[\]]/g, '')
      .substring(0, 31)
      .trim()

    XLSX.utils.book_append_sheet(wb, ws, tabName || `Grupo ${rootTask.id.slice(0, 6)}`)
  }

  const safeProjectName = projectName.replace(/[\\/:*?[\]]/g, '').substring(0, 40)
  XLSX.writeFile(wb, `${safeProjectName} - Tarefas.xlsx`)
}
