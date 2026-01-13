import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from './queryKeys'
import { Resource } from '@/types/database.types'

/**
 * Query para buscar todos os recursos ativos
 */
export function useActiveResources() {
  return useQuery({
    queryKey: queryKeys.resources.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return data as Resource[]
    }
  })
}

/**
 * Query para buscar todos os recursos (ativos e inativos)
 */
export function useAllResources() {
  return useQuery({
    queryKey: queryKeys.resources.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return data as Resource[]
    }
  })
}

/**
 * Query para buscar um recurso específico
 */
export function useResource(resourceId: string) {
  return useQuery({
    queryKey: queryKeys.resources.detail(resourceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('id', resourceId)
        .single()

      if (error) throw error
      return data as Resource
    },
    enabled: !!resourceId
  })
}
