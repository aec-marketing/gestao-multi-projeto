'use client'

import { useParams } from 'next/navigation'
import ProjectGanttPage from '@/components/ProjectGanttPage'

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.id as string

  return <ProjectGanttPage projectId={projectId} />
}