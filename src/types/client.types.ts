/**
 * Client Types
 * Tipos relacionados aos clientes dos projetos
 */

export interface Client {
  id: string
  name: string
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface ClientInsert {
  name: string
  logo_url?: string | null
}

export interface ClientUpdate {
  name?: string
  logo_url?: string | null
}

/**
 * Client selection data for autocomplete
 */
export interface ClientOption {
  id: string
  name: string
  logo_url: string | null
}
