'use client'

import React from 'react'

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingOverlay({ isLoading, message = 'Carregando...', size = 'md' }: LoadingOverlayProps) {
  if (!isLoading) return null

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  }

  return (
    <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
      <div className="text-center">
        <div className={`animate-spin rounded-full border-b-2 border-blue-600 mx-auto mb-4 ${sizeClasses[size]}`}></div>
        <p className="text-sm text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  )
}

interface LoadingCellProps {
  isLoading: boolean
  children: React.ReactNode
}

export function LoadingCell({ isLoading, children }: LoadingCellProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return <>{children}</>
}

export default LoadingOverlay
