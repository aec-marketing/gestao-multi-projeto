'use client'

import React, { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info' | 'saving'
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'info', onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    if (type !== 'saving') {
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration, onClose, type])

  const styles = {
    success: {
      bg: 'bg-green-500',
      icon: '✓'
    },
    error: {
      bg: 'bg-red-500',
      icon: '✕'
    },
    info: {
      bg: 'bg-blue-500',
      icon: 'ℹ'
    },
    saving: {
      bg: 'bg-gray-700',
      icon: null
    }
  }

  const style = styles[type]

  return (
    <>
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
      <div className="fixed bottom-4 right-4 z-[100] animate-slide-up">
      <div className={`${style.bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[250px]`}>
        {type === 'saving' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        ) : (
          <span className="text-lg">{style.icon}</span>
        )}
        <span className="text-sm font-medium flex-1">{message}</span>
        {type !== 'saving' && (
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors text-lg"
          >
            ×
          </button>
        )}
      </div>
      </div>
    </>
  )
}

export default Toast
