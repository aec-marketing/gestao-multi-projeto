'use client'

import { useParams } from 'next/navigation'
import GanttPresentationPage from '@/components/GanttPresentationPage'
import { Suspense } from 'react'

function PresentationPageContent() {
  const params = useParams()
  const projectId = params.id as string

  return <GanttPresentationPage projectId={projectId} />
}

export default function PresentationPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando visualização...</div>}>
      <PresentationPageContent />
    </Suspense>
  )
}
