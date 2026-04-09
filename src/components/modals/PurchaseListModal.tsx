'use client'

import React, { useState, useEffect } from 'react'
import { Project } from '@/types/database.types'

interface PurchaseItem {
  id?: string          // undefined = item novo; definido = item existente no banco
  name: string
  vendor: string
  durationDays: number
  estimatedCost: number
  progress?: number    // somente leitura — exibido para avisar o usuário
}

interface PurchaseListModalProps {
  project: Project
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: PurchaseListData) => Promise<void>
  isLoading?: boolean
  // Modo edição
  editMode?: boolean
  editListId?: string        // ID da tarefa pai (lista_compras)
  editListName?: string
  editStartDate?: string
  editItems?: PurchaseItem[] // itens existentes pré-carregados
}

export interface PurchaseListData {
  listName: string
  startDate: string
  items: PurchaseItem[]
  // em modo edit, também informa quais IDs foram removidos
  removedIds?: string[]
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
  editMode = false,
  editListId,
  editListName = '',
  editStartDate,
  editItems = [],
}: PurchaseListModalProps) {
  const defaultDate = project.start_date || new Date().toISOString().split('T')[0]

  const [listName, setListName] = useState('')
  const [startDate, setStartDate] = useState(defaultDate)
  const [items, setItems] = useState<PurchaseItem[]>([{ ...EMPTY_ITEM }])
  const [removedIds, setRemovedIds] = useState<string[]>([])

  // Sincronizar estado quando props de edição mudam (ao abrir o modal)
  useEffect(() => {
    if (!isOpen) return
    if (editMode) {
      setListName(editListName)
      setStartDate(editStartDate || defaultDate)
      setItems(editItems.length > 0 ? editItems : [{ ...EMPTY_ITEM }])
      setRemovedIds([])
    } else {
      setListName('')
      setStartDate(defaultDate)
      setItems([{ ...EMPTY_ITEM }])
      setRemovedIds([])
    }
  }, [isOpen, editMode])

  if (!isOpen) return null

  const handleAddItem = () => {
    setItems(prev => [...prev, { ...EMPTY_ITEM }])
  }

  const handleRemoveItem = (index: number) => {
    const item = items[index]
    if (item.id) {
      // registrar para deleção no banco
      setRemovedIds(prev => [...prev, item.id!])
    }
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: string | number) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const handleConfirm = async () => {
    await onConfirm({ listName, startDate, items, removedIds })
    if (!editMode) {
      setListName('')
      setStartDate(defaultDate)
      setItems([{ ...EMPTY_ITEM }])
      setRemovedIds([])
    }
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
            <h3 className="text-lg font-semibold text-gray-900">
              {editMode ? 'Editar Lista de Compras' : 'Nova Lista de Compras'}
            </h3>
            <p className="text-sm text-gray-500">
              {editMode
                ? 'Adicione, edite ou remova itens da lista existente'
                : 'Crie uma lista de itens a comprar/contratar para o projeto'}
            </p>
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

            {/* Cabeçalho */}
            <div className="grid grid-cols-12 gap-2 mb-1 px-2">
              <span className="col-span-4 text-xs text-gray-500 font-medium">Item / Descrição</span>
              <span className="col-span-3 text-xs text-gray-500 font-medium">Fornecedor</span>
              <span className="col-span-2 text-xs text-gray-500 font-medium text-center">Prazo (dias)</span>
              <span className="col-span-2 text-xs text-gray-500 font-medium text-right">Valor est. (R$)</span>
              <span className="col-span-1"></span>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => {
                const isExisting = Boolean(item.id)
                const hasProgress = (item.progress ?? 0) > 0
                return (
                  <div
                    key={item.id ?? `new-${index}`}
                    className={`grid grid-cols-12 gap-2 items-center rounded-lg p-2 ${
                      isExisting ? 'bg-gray-50' : 'bg-orange-50 border border-orange-200'
                    }`}
                  >
                    <div className="col-span-4">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => handleItemChange(index, 'name', e.target.value)}
                          placeholder="Nome do item"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                          disabled={isLoading}
                        />
                      </div>
                      {!isExisting && (
                        <span className="text-[10px] text-orange-500 font-medium ml-0.5">novo</span>
                      )}
                      {isExisting && hasProgress && (
                        <span className="text-[10px] text-blue-500 font-medium ml-0.5">{item.progress}% concluído</span>
                      )}
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
                        disabled={isLoading || (hasProgress && isExisting)}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={hasProgress && isExisting ? 'Item com progresso não pode ser removido' : 'Remover item'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
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
            {editMode
              ? 'Itens existentes serão atualizados. Itens com progresso registrado não podem ser removidos. Novos itens (fundo laranja) serão adicionados à lista.'
              : 'Cada item será criado como uma subtarefa com prazo em dias corridos (incluindo fins de semana). O campo "Fornecedor" é apenas informativo e pode ser preenchido depois.'}
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
                {editMode ? 'Salvando...' : 'Criando...'}
              </>
            ) : (
              editMode ? 'Salvar alterações' : 'Criar Lista de Compras'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PurchaseListModal
