'use client'

import { Suspense } from 'react'
import CalendarLayout from '@/components/calendar-v2/CalendarLayout'

function CalendarPageContent() {
  return <CalendarLayout />
}

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4 text-lg">Carregando calendário...</p>
        </div>
      </div>
    }>
      <CalendarPageContent />
    </Suspense>
  )
}
