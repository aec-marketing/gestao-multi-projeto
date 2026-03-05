'use client'

import React, { useState } from 'react'
import { Project } from '@/types/database.types'

interface PurchaseItem {
  name: string
  vendor: string
  durationDays: number
  estimatedCost: number
}

interface PurchaseListModalProps {
  project: Project
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: PurchaseListData) => Promise<void>
  isLoading?: boolean
}

export interface PurchaseListData {
  listName: string
  startDate: string
  items: PurchaseItem[]
}

const EMPTY_ITEM: PurchaseItem = {
  name: '',
  vendor: '',
  durationDays: 7,
  estimatedCost: 0,
}

export function PurchaseListModal({
  project,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: PurchaseListModalProps) {
  const [listName, setListName] = useState('')
  const [startDate, setStartDate] = useState(
    project.start_date || new Date().toISOString().split('T')[0]
  )
  const [items, setItems] = useState<PurchaseItem[]>([{ ...EMPTY_ITEM }])

  if (!isOpen) return null

  const handleAddItem = () => {
    setItems(prev => [...prev, { ...EMPTY_ITEM }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: string | number) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const handleConfirm = async () => {
    await onConfirm({ listName, startDate, items })
    // Reset form on success
    setListName('')
    setStartDate(project.start_date || new Date().toISOString().split('T')[0])
    setItems([{ ...EMPTY_ITEM }])
  }

  const isValid = listName.trim() !== '' && items.every(item => item.name.trim() !== '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
            🛒
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Nova Lista de Compras</h3>
            <p className="text-sm text-gray-500">Crie uma lista de itens a comprar/contratar para o projeto</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Nome da lista e data de solicitação */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da lista <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={listName}
                onChange={e => setListName(e.target.value)}
                placeholder="Ex: Compras estrutura metálica"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de solicitação
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Itens da lista <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-400">{items.length} item(ns)</span>
            </div>

            {/* Cabeçalho da tabela de itens */}
            <div className="grid grid-cols-12 gap-2 mb-1 px-2">
              <span className="col-span-4 text-xs text-gray-500 font-medium">Item / Descrição</span>
              <span className="col-span-3 text-xs text-gray-500 font-medium">Fornecedor</span>
              <span className="col-span-2 text-xs text-gray-500 font-medium text-center">Prazo (dias)</span>
              <span className="col-span-2 text-xs text-gray-500 font-medium text-right">Valor est. (R$)</span>
              <span className="col-span-1"></span>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                  <div className="col-span-4">
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => handleItemChange(index, 'name', e.target.value)}
                      placeholder="Nome do item"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={item.vendor}
                      onChange={e => handleItemChange(index, 'vendor', e.target.value)}
                      placeholder="Fornecedor"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.durationDays}
                      onChange={e => handleItemChange(index, 'durationDays', Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-center focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.estimatedCost || ''}
                      onChange={e => handleItemChange(index, 'estimatedCost', parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0,00"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => handleRemoveItem(index)}
                      disabled={items.length <= 1 || isLoading}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remover item"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddItem}
              disabled={isLoading}
              className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Adicionar item
            </button>
          </div>

          {/* Info */}
          <p className="text-xs text-gray-400 bg-gray-50 rounded p-3">
            Cada item será criado como uma subtarefa com prazo em dias corridos (incluindo fins de semana).
            {'O campo "Fornecedor" é apenas informativo e pode ser preenchido depois.'}
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Criando...
              </>
            ) : (
              'Criar Lista de Compras'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PurchaseListModal
