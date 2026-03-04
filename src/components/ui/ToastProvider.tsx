'use client'

import { useEffect, useState } from 'react'
import { Toast } from './Toast'

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let toastIdCounter = 0

// Função global para disparar toasts de qualquer lugar (hooks, utils, etc.)
export function dispatchToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }))
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail
      const id = ++toastIdCounter
      setToasts(prev => [...prev, { id, message, type }])
    }

    window.addEventListener('app:toast', handler)
    return () => window.removeEventListener('app:toast', handler)
  }, [])

  const remove = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => remove(toast.id)}
        />
      ))}
    </div>
  )
}
