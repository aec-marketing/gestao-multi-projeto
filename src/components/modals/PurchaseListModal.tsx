'use client'

import React, { useState, useEffect } from 'react'
import { Project } from '@/types/database.types'

// ============================================================
// Tipos
// ============================================================

export interface PurchaseItem {
  id?: string           // undefined = novo
  name: string
  durationDays: number
  estimatedCost: number
  progress?: number     // somente leitura
}

export interface PurchaseGroup {
  id?: string           // undefined = novo grupo
  name: string          // nome do fornecedor/agrupador
  durationDays: number  // prazo do grupo (max dos itens, calculado ao salvar)
  items: PurchaseItem[]
  progress?: number     // somente leitura
}

// Entrada da lista: grupo OU item avulso
export type PurchaseEntry =
  | { kind: 'group'; group: PurchaseGroup }
  | { kind: 'item';  item: PurchaseItem }

export interface PurchaseListData {
  listName: string
  startDate: string
  entries: PurchaseEntry[]
  removedIds?: string[]   // IDs de tasks deletadas (grupos e itens)
}

// ============================================================
// Constantes
// ============================================================

const EMPTY_ITEM: PurchaseItem = { name: '', durationDays: 7, estimatedCost: 0 }
const EMPTY_GROUP: PurchaseGroup = { name: '', durationDays: 7, items: [{ ...EMPTY_ITEM }] }

// ============================================================
// Props
// ============================================================

interface PurchaseListModalProps {
  project: Project
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: PurchaseListData) => Promise<void>
  isLoading?: boolean
  editMode?: boolean
  editListName?: string
  editStartDate?: string
  editEntries?: PurchaseEntry[]
}

// ============================================================
// Sub-componentes
// ============================================================

function ItemRow({
  item,
  onChange,
  onRemove,
  disabled,
  isNew,
}: {
  item: PurchaseItem
  onChange: (field: keyof PurchaseItem, value: string | number) => void
  onRemove: () => void
  disabled: boolean
  isNew: boolean
}) {
  const hasProgress = (item.progress ?? 0) > 0
  const canRemove = !disabled && !(hasProgress && !isNew)

  return (
    <div className={`grid grid-cols-12 gap-2 items-start rounded-lg p-2 ${isNew ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
      <div className="col-span-5">
        <input
          type="text"
          value={item.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="Nome do item"
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
          disabled={disabled}
        />
        {isNew && <span className="text-[10px] text-orange-500 font-medium">novo</span>}
        {!isNew && hasProgress && <span className="text-[10px] text-blue-500 font-medium">{item.progress}% concluído</span>}
      </div>
      <div className="col-span-3">
        <input
          type="number"
          value={item.durationDays}
          onChange={e => onChange('durationDays', Math.max(1, parseInt(e.target.value) || 1))}
          min={1}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-center bg-white focus:ring-1 focus:ring-orange-500"
          disabled={disabled}
        />
      </div>
      <div className="col-span-3">
        <input
          type="number"
          value={item.estimatedCost || ''}
          onChange={e => onChange('estimatedCost', parseFloat(e.target.value) || 0)}
          min={0}
          step={0.01}
          placeholder="0,00"
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right bg-white focus:ring-1 focus:ring-orange-500"
          disabled={disabled}
        />
      </div>
      <div className="col-span-1 flex justify-center pt-1.5">
        <button
          onClick={onRemove}
          disabled={!canRemove}
          title={hasProgress && !isNew ? 'Item com progresso não pode ser removido' : 'Remover item'}
          className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Modal principal
// ============================================================

export function PurchaseListModal({
  project,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  editMode = false,
  editListName = '',
  editStartDate,
  editEntries = [],
}: PurchaseListModalProps) {
  const defaultDate = project.start_date || new Date().toISOString().split('T')[0]

  const [listName, setListName] = useState('')
  const [startDate, setStartDate] = useState(defaultDate)
  const [entries, setEntries] = useState<PurchaseEntry[]>([{ kind: 'item', item: { ...EMPTY_ITEM } }])
  const [removedIds, setRemovedIds] = useState<string[]>([])

  useEffect(() => {
    if (!isOpen) return
    if (editMode) {
      setListName(editListName)
      setStartDate(editStartDate || defaultDate)
      setEntries(editEntries.length > 0 ? editEntries : [{ kind: 'item', item: { ...EMPTY_ITEM } }])
      setRemovedIds([])
    } else {
      setListName('')
      setStartDate(defaultDate)
      setEntries([{ kind: 'item', item: { ...EMPTY_ITEM } }])
      setRemovedIds([])
    }
  }, [isOpen, editMode])

  if (!isOpen) return null

  // ---------- helpers ----------

  const registerRemoved = (id?: string) => {
    if (id) setRemovedIds(prev => [...prev, id])
  }

  // ---------- entry-level ops ----------

  const addItem = () =>
    setEntries(prev => [...prev, { kind: 'item', item: { ...EMPTY_ITEM } }])

  const addGroup = () =>
    setEntries(prev => [...prev, { kind: 'group', group: { ...EMPTY_GROUP, items: [{ ...EMPTY_ITEM }] } }])

  const removeEntry = (eIdx: number) => {
    const entry = entries[eIdx]
    if (entry.kind === 'item') registerRemoved(entry.item.id)
    if (entry.kind === 'group') {
      registerRemoved(entry.group.id)
      entry.group.items.forEach(i => registerRemoved(i.id))
    }
    setEntries(prev => prev.filter((_, i) => i !== eIdx))
  }

  const updateItem = (eIdx: number, field: keyof PurchaseItem, value: string | number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== eIdx || e.kind !== 'item') return e
      return { kind: 'item', item: { ...e.item, [field]: value } }
    }))
  }

  const updateGroupName = (eIdx: number, name: string) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== eIdx || e.kind !== 'group') return e
      return { kind: 'group', group: { ...e.group, name } }
    }))
  }

  // ---------- item-inside-group ops ----------

  const addItemToGroup = (eIdx: number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== eIdx || e.kind !== 'group') return e
      return { kind: 'group', group: { ...e.group, items: [...e.group.items, { ...EMPTY_ITEM }] } }
    }))
  }

  const removeItemFromGroup = (eIdx: number, iIdx: number) => {
    const entry = entries[eIdx]
    if (entry.kind !== 'group') return
    registerRemoved(entry.group.items[iIdx].id)
    setEntries(prev => prev.map((e, i) => {
      if (i !== eIdx || e.kind !== 'group') return e
      return { kind: 'group', group: { ...e.group, items: e.group.items.filter((_, j) => j !== iIdx) } }
    }))
  }

  const updateGroupItem = (eIdx: number, iIdx: number, field: keyof PurchaseItem, value: string | number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== eIdx || e.kind !== 'group') return e
      const items = e.group.items.map((item, j) =>
        j === iIdx ? { ...item, [field]: value } : item
      )
      return { kind: 'group', group: { ...e.group, items } }
    }))
  }

  // Converte um item avulso existente em grupo:
  // - O ID do item vai para removedIds (será deletado no banco)
  // - Se tinha progresso/custo, cria um placeholder filho com esses valores
  // - O grupo recebe o nome do item original
  const convertItemToGroup = (eIdx: number) => {
    const entry = entries[eIdx]
    if (entry.kind !== 'item') return
    const item = entry.item

    // Registrar o ID do item para deleção (será recriado como grupo_compras + filhos)
    if (item.id) registerRemoved(item.id)

    const hasValues = (item.progress ?? 0) > 0 || item.estimatedCost > 0

    const placeholderItem: PurchaseItem = hasValues
      ? {
          // sem id — será inserido novo
          name: item.name,
          durationDays: item.durationDays,
          estimatedCost: item.estimatedCost,
          progress: item.progress,
        }
      : { ...EMPTY_ITEM }

    const newGroup: PurchaseGroup = {
      // sem id — será criado como grupo_compras novo
      name: item.name,
      durationDays: item.durationDays,
      items: [placeholderItem],
    }

    setEntries(prev => prev.map((e, i) =>
      i === eIdx ? { kind: 'group', group: newGroup } : e
    ))
  }

  // ---------- submit ----------

  const handleConfirm = async () => {
    await onConfirm({ listName, startDate, entries, removedIds })
    if (!editMode) {
      setListName('')
      setStartDate(defaultDate)
      setEntries([{ kind: 'item', item: { ...EMPTY_ITEM } }])
      setRemovedIds([])
    }
  }

  const isValid = listName.trim() !== '' && entries.every(e => {
    if (e.kind === 'item') return e.item.name.trim() !== ''
    return e.group.name.trim() !== '' && e.group.items.every(i => i.name.trim() !== '')
  })

  // ---------- render ----------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-6 border-b flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">🛒</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {editMode ? 'Editar Lista de Compras' : 'Nova Lista de Compras'}
            </h3>
            <p className="text-sm text-gray-500">
              {editMode ? 'Adicione, edite ou remova itens e grupos' : 'Crie uma lista de itens a comprar/contratar'}
            </p>
          </div>
          <button onClick={onClose} disabled={isLoading} className="ml-auto text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* Nome + Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da lista <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={listName}
                onChange={e => setListName(e.target.value)}
                placeholder="Ex: Compras Elétricas"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de solicitação</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Entradas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Itens e grupos</label>
              <span className="text-xs text-gray-400">{entries.length} entrada(s)</span>
            </div>

            {/* Cabeçalho colunas */}
            <div className="grid grid-cols-12 gap-2 px-2 mb-1">
              <span className="col-span-5 text-xs text-gray-500 font-medium">Nome</span>
              <span className="col-span-3 text-xs text-gray-500 font-medium text-center">Prazo (dias)</span>
              <span className="col-span-3 text-xs text-gray-500 font-medium text-right">Valor est. (R$)</span>
              <span className="col-span-1"></span>
            </div>

            {entries.map((entry, eIdx) => {
              if (entry.kind === 'item') {
                const canConvert = editMode && !!entry.item.id
                return (
                  <div key={entry.item.id ?? `item-${eIdx}`} className="flex items-start gap-1">
                    <div className="flex-1">
                      <ItemRow
                        item={entry.item}
                        isNew={!entry.item.id}
                        disabled={isLoading}
                        onChange={(f, v) => updateItem(eIdx, f, v)}
                        onRemove={() => removeEntry(eIdx)}
                      />
                    </div>
                    {canConvert && (
                      <button
                        onClick={() => convertItemToGroup(eIdx)}
                        disabled={isLoading}
                        title="Transformar em grupo (fornecedor)"
                        className="mt-1 px-1.5 py-1 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
                      >
                        → Grupo
                      </button>
                    )}
                  </div>
                )
              }

              // grupo
              const group = entry.group
              const isNewGroup = !group.id
              return (
                <div key={group.id ?? `group-${eIdx}`} className="border border-blue-200 rounded-lg overflow-hidden">
                  {/* Header do grupo */}
                  <div className="bg-blue-50 px-3 py-2 flex items-center gap-2">
                    <span className="text-blue-600 text-sm">📦</span>
                    <input
                      type="text"
                      value={group.name}
                      onChange={e => updateGroupName(eIdx, e.target.value)}
                      placeholder="Nome do fornecedor / agrupador *"
                      className="flex-1 border border-blue-200 rounded px-2 py-1 text-sm text-gray-900 bg-white focus:ring-1 focus:ring-blue-500"
                      disabled={isLoading}
                    />
                    {isNewGroup && <span className="text-[10px] text-orange-500 font-medium whitespace-nowrap">novo grupo</span>}
                    {!isNewGroup && (group.progress ?? 0) > 0 && (
                      <span className="text-[10px] text-blue-500 font-medium whitespace-nowrap">{group.progress}% concluído</span>
                    )}
                    <button
                      onClick={() => removeEntry(eIdx)}
                      disabled={isLoading || (!isNewGroup && (group.progress ?? 0) > 0)}
                      title={!isNewGroup && (group.progress ?? 0) > 0 ? 'Grupo com progresso não pode ser removido' : 'Remover grupo e seus itens'}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ml-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Itens do grupo */}
                  <div className="p-2 space-y-2">
                    {group.items.map((item, iIdx) => (
                      <ItemRow
                        key={item.id ?? `gitem-${eIdx}-${iIdx}`}
                        item={item}
                        isNew={!item.id}
                        disabled={isLoading}
                        onChange={(f, v) => updateGroupItem(eIdx, iIdx, f, v)}
                        onRemove={() => removeItemFromGroup(eIdx, iIdx)}
                      />
                    ))}
                    <button
                      onClick={() => addItemToGroup(eIdx)}
                      disabled={isLoading}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 pl-1"
                    >
                      + Adicionar item ao grupo
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Botões de adicionar */}
            <div className="flex gap-4 pt-1">
              <button
                onClick={addItem}
                disabled={isLoading}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
              >
                + Item avulso
              </button>
              <button
                onClick={addGroup}
                disabled={isLoading}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                + Grupo (fornecedor)
              </button>
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-gray-400 bg-gray-50 rounded p-3">
            {editMode
              ? 'Itens/grupos existentes serão atualizados. Com progresso registrado não podem ser removidos. Novos aparecem em laranja.'
              : 'Grupos criam um nível intermediário (ex: fornecedor) com seus itens abaixo. Itens avulsos ficam diretamente na lista.'}
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
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
