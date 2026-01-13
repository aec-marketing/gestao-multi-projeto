import type { Metadata } from 'next'
import './globals.css'
import { ErrorBoundary } from '@/components/error-boundary'
import { ResourceProvider } from '@/contexts/ResourceContext'
import { QueryProvider } from '@/providers/QueryProvider'

export const metadata: Metadata = {
  title: 'Sistema de Gestão Multi-Projeto',
  description: 'Gestão consolidada de múltiplos projetos com interface similar ao MS Project',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <ErrorBoundary>
          <QueryProvider>
            <ResourceProvider>
              {children}
            </ResourceProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
