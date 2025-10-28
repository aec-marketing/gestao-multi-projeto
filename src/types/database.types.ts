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
          is_active: boolean
          notes: string | null
              estimated_cost: number        // ← ADICIONE
    actual_cost: number           // ← ADICIONE
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
          complexity?: 'simples' | 'padrao' | 'complexo'
          buffer_days?: number
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          notes?: string | null
              estimated_cost?: number       // ← ADICIONE
    actual_cost?: number          // ← ADICIONE
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
          is_active?: boolean
          notes?: string | null
              estimated_cost?: number       // ← ADICIONE
    actual_cost?: number          // ← ADICIONE
        }
      }
      resources: {
        Row: {
          id: string
          name: string
          email: string | null
          role: 'gerente' | 'lider' | 'operador'
          leader_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          role: 'gerente' | 'lider' | 'operador'
          leader_id?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          role?: 'gerente' | 'lider' | 'operador'
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