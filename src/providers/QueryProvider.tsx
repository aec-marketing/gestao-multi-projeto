'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Data permanece "fresh" por 5 minutos
        staleTime: 1000 * 60 * 5,
        // Cache mantido por 10 minutos
        gcTime: 1000 * 60 * 10,
        // Não refetch ao voltar para a aba
        refetchOnWindowFocus: false,
        // Retry uma vez em caso de erro
        retry: 1
      },
      mutations: {
        // Retry uma vez em caso de erro
        retry: 1
      }
    }
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
