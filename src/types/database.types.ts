// Tipos do banco de dados
export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          code: string
          name: string
          category: 'laudo_tecnico' | 'projeto_mecanico' | 'projeto_eletrico' | 'projeto_mecanico_eletrico' | 'projeto_completo' | 'manutencao' | 'readequacao' | 'retrofit'
          vendor_name: string
          leader_id: string | null
          template_id: string | null
          complexity: 'simples' | 'padrao' | 'complexo'
          buffer_days: number
          start_date: string | null
          end_date: string | null
          target_end_date: string | null  // Data alvo/limite do projeto
          is_active: boolean
          notes: string | null
          client_name: string | null      // Nome do cliente
          client_logo_url: string | null  // URL da logo do cliente
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          category: 'laudo_tecnico' | 'projeto_mecanico' | 'projeto_eletrico' | 'projeto_mecanico_eletrico' | 'projeto_completo' | 'manutencao' | 'readequacao' | 'retrofit'
          vendor_name: string
          leader_id?: string | null
          template_id?: string | null
          complexity: 'simples' | 'padrao' | 'complexo'
          buffer_days?: number
          start_date?: string | null
          end_date?: string | null
          target_end_date?: string | null
          is_active?: boolean
          notes?: string | null
          client_name?: string | null
          client_logo_url?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          category?: 'laudo_tecnico' | 'projeto_mecanico' | 'projeto_eletrico' | 'projeto_mecanico_eletrico' | 'projeto_completo' | 'manutencao' | 'readequacao' | 'retrofit'
          vendor_name?: string
          leader_id?: string | null
          template_id?: string | null
          complexity?: 'simples' | 'padrao' | 'complexo'
          buffer_days?: number
          start_date?: string | null
          end_date?: string | null
          target_end_date?: string | null  // Data alvo/limite do projeto
          is_active?: boolean
          notes?: string | null
          client_name?: string | null
          client_logo_url?: string | null
        }
      }
      resources: {
        Row: {
          id: string
          name: string
          email: string | null
          hierarchy: 'gerente' | 'lider' | 'operador'  // Hierarquia funcional (fixa)
          role: string | null  // Função/especialidade - texto livre (visual)
          leader_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          hierarchy: 'gerente' | 'lider' | 'operador'
          role?: string | null
          leader_id?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          hierarchy?: 'gerente' | 'lider' | 'operador'
          role?: string | null
          leader_id?: string | null
          is_active?: boolean
        }
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          name: string
          type: 'projeto_mecanico' | 'compras_mecanica' | 'projeto_eletrico' | 'compras_eletrica' | 'fabricacao' | 'tratamento_superficial' | 'montagem_mecanica' | 'montagem_eletrica' | 'coleta' | 'subtarefa'
          parent_id: string | null
          duration: number
          start_date: string | null
          end_date: string | null
          is_optional: boolean
          is_critical_path: boolean
          progress: number
          notes: string | null
          sort_order: number
          estimated_cost: number
          actual_cost: number
          margin_start: number
          margin_end: number
          outline_level: number | null
          wbs_code: string | null
          is_summary: boolean
          lag_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          type: 'projeto_mecanico' | 'compras_mecanica' | 'projeto_eletrico' | 'compras_eletrica' | 'fabricacao' | 'tratamento_superficial' | 'montagem_mecanica' | 'montagem_eletrica' | 'coleta' | 'subtarefa'
          parent_id?: string | null
          duration?: number
          start_date?: string | null
          end_date?: string | null
          is_optional?: boolean
          is_critical_path?: boolean
          progress?: number
          notes?: string | null
          sort_order?: number
          estimated_cost?: number
          actual_cost?: number
          margin_start?: number
          margin_end?: number
          lag_days?: number
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          type?: 'projeto_mecanico' | 'compras_mecanica' | 'projeto_eletrico' | 'compras_eletrica' | 'fabricacao' | 'tratamento_superficial' | 'montagem_mecanica' | 'montagem_eletrica' | 'coleta' | 'subtarefa'
          parent_id?: string | null
          duration?: number
          start_date?: string | null
          end_date?: string | null
          is_optional?: boolean
          is_critical_path?: boolean
          progress?: number
          notes?: string | null
          sort_order?: number
          estimated_cost?: number
          actual_cost?: number
          margin_start?: number
          margin_end?: number
          outline_level?: number
          wbs_code?: string | null
          is_summary?: boolean
          lag_days?: number
        }
      }
    }
  }
}

// Tipos específicos do projeto
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export type Resource = Database['public']['Tables']['resources']['Row']
export type ResourceInsert = Database['public']['Tables']['resources']['Insert']
export type ResourceUpdate = Database['public']['Tables']['resources']['Update']

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']

// Tipos para componentes
export type ProjectWithLeader = Project & {
  leader?: Resource
}

export type TaskWithProject = Task & {
  project: Project
}

export type ProjectCategory = Project['category']
export type ProjectComplexity = Project['complexity']
export type ResourceRole = Resource['role']
export type TaskType = Task['type']


// Tipos para Import MS Project
export interface MSProjectTask {
  uid: number                  // UID do XML
  name: string
  outlineNumber: string        // Ex: "1.1.1"
  outlineLevel: number         // 0, 1, 2, 3...
  start: Date
  finish: Date
  duration: number             // Em dias
  percentComplete: number
  isSummary: boolean
  isCritical: boolean
  predecessors: {
    uid: number
    type: 'FF' | 'FS' | 'SF' | 'SS'
    lag: number                // Em dias
  }[]
}

// Tipo para preview antes do import
export interface ImportPreview {
  project: {
    code: string
    name: string
    startDate: Date
    endDate: Date
    totalTasks: number
    totalDuration: number
  }
  tasks: MSProjectTask[]
  stats: {
    level1Tasks: number
    level2Tasks: number
    level3PlusTasks: number    // Tarefas de nível 3 ou superior
    tasksWithPredecessors: number
    completedTasks: number
    summaryTasks: number
    criticalTasks: number
  }
}

// Mapa de UID do XML para ID do banco (usado durante import)
export type UIDMap = Map<number, string>