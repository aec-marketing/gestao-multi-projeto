// lib/msproject/validation.ts
// Validações para predecessores e detecção de ciclos

export interface CycleDetectionResult {
  hasCycle: boolean
  cycleNodes: string[]        // IDs das tarefas no ciclo
  cyclePath: string[]          // Caminho do ciclo (A → B → C → A)
}

/**
 * Detecta ciclos em predecessores usando algoritmo DFS (Depth-First Search)
 *
 * @param tasks - Lista de tarefas
 * @param predecessors - Lista de predecessores
 * @returns Resultado da detecção
 */
export function detectCycles(
  tasks: Array<{ id: string; name: string }>,
  predecessors: Array<{ task_id: string; predecessor_id: string }>
): CycleDetectionResult {
  // Construir grafo de adjacência
  const graph = new Map<string, string[]>()
  const taskNames = new Map<string, string>()

  // Inicializar grafo
  tasks.forEach(t => {
    graph.set(t.id, [])
    taskNames.set(t.id, t.name)
  })

  // Adicionar arestas (predecessores)
  predecessors.forEach(p => {
    const edges = graph.get(p.task_id) || []
    edges.push(p.predecessor_id)
    graph.set(p.task_id, edges)
  })

  // Sets para rastreamento DFS
  const visited = new Set<string>()
  const recStack = new Set<string>()
  const cycleNodes = new Set<string>()
  let cyclePath: string[] = []

  /**
   * DFS recursivo para detectar ciclos
   */
  function dfs(taskId: string, path: string[]): boolean {
    visited.add(taskId)
    recStack.add(taskId)
    path.push(taskId)

    // Explorar vizinhos (predecessores)
    const neighbors = graph.get(taskId) || []

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        // Explorar não visitado
        if (dfs(neighbor, [...path])) {
          cycleNodes.add(taskId)
          return true
        }
      } else if (recStack.has(neighbor)) {
        // Encontrou ciclo!
        cycleNodes.add(taskId)
        cycleNodes.add(neighbor)

        // Construir caminho do ciclo
        const cycleStartIndex = path.indexOf(neighbor)
        cyclePath = path.slice(cycleStartIndex)
        cyclePath.push(neighbor) // Fechar o ciclo

        return true
      }
    }

    recStack.delete(taskId)
    return false
  }

  // Executar DFS em todas as tarefas
  for (const task of tasks) {
    if (!visited.has(task.id)) {
      if (dfs(task.id, [])) {
        // Converter IDs para nomes legíveis
        const cyclePathWithNames = cyclePath.map(id => {
          const name = taskNames.get(id) || id.slice(0, 8)
          return name
        })

        return {
          hasCycle: true,
          cycleNodes: Array.from(cycleNodes),
          cyclePath: cyclePathWithNames
        }
      }
    }
  }

  return {
    hasCycle: false,
    cycleNodes: [],
    cyclePath: []
  }
}

/**
 * Valida se adicionar um novo predecessor criaria um ciclo
 *
 * @param taskId - Tarefa que vai receber o predecessor
 * @param predecessorId - Tarefa que será o predecessor
 * @param existingPredecessors - Predecessores já existentes
 * @param tasks - Lista de tarefas
 * @returns true se criar ciclo, false se ok
 */
export function wouldCreateCycle(
  taskId: string,
  predecessorId: string,
  existingPredecessors: Array<{ task_id: string; predecessor_id: string }>,
  tasks: Array<{ id: string; name: string }>
): boolean {
  // Auto-referência é ciclo imediato
  if (taskId === predecessorId) {
    return true
  }

  // Simular adição do novo predecessor
  const simulatedPredecessors = [
    ...existingPredecessors,
    { task_id: taskId, predecessor_id: predecessorId }
  ]

  // Detectar ciclos com a nova configuração
  const result = detectCycles(tasks, simulatedPredecessors)
  return result.hasCycle
}

/**
 * Encontra todos os ciclos em um projeto
 *
 * @param tasks - Lista de tarefas
 * @param predecessors - Lista de predecessores
 * @returns Lista de ciclos encontrados
 */
export function findAllCycles(
  tasks: Array<{ id: string; name: string }>,
  predecessors: Array<{ task_id: string; predecessor_id: string }>
): CycleDetectionResult[] {
  const cycles: CycleDetectionResult[] = []
  const processedNodes = new Set<string>()

  // Detectar ciclo para cada tarefa não processada
  for (const task of tasks) {
    if (processedNodes.has(task.id)) continue

    const result = detectCycles(
      tasks.filter(t => !processedNodes.has(t.id)),
      predecessors
    )

    if (result.hasCycle) {
      cycles.push(result)
      result.cycleNodes.forEach(node => processedNodes.add(node))
    }
  }

  return cycles
}

/**
 * Sugere predecessores que podem ser removidos para quebrar um ciclo
 *
 * @param cycleNodes - Nós do ciclo
 * @param predecessors - Lista de predecessores
 * @returns Lista de predecessores sugeridos para remoção
 */
export function suggestCycleBreakers(
  cycleNodes: string[],
  predecessors: Array<{ id: string; task_id: string; predecessor_id: string; type: string; lag_time: number }>
): Array<{ id: string; task_id: string; predecessor_id: string; type: string; lag_time: number; reason: string }> {
  const suggestions: Array<{ id: string; task_id: string; predecessor_id: string; type: string; lag_time: number; reason: string }> = []

  // Encontrar predecessores que conectam nós do ciclo
  const cycleSet = new Set(cycleNodes)

  predecessors.forEach(pred => {
    if (cycleSet.has(pred.task_id) && cycleSet.has(pred.predecessor_id)) {
      suggestions.push({
        ...pred,
        reason: 'Conecta tarefas no ciclo'
      })
    }
  })

  return suggestions
}
