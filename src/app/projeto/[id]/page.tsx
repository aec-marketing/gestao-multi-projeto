'use client'

import { useParams, useSearchParams } from 'next/navigation'
import ProjectGanttPage from '@/components/ProjectGanttPage'
import { Suspense } from 'react'

function ProjectPageContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const highlightTaskId = searchParams?.get('highlightTask') || undefined

  return <ProjectGanttPage projectId={projectId} highlightTaskId={highlightTaskId} />
}

export default function ProjectPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando projeto...</div>}>
      <ProjectPageContent />
    </Suspense>
  )
}