/**
 * Lista de despesas avulsas do projeto
 * Permite adicionar, editar e excluir despesas (description, amount, date, notes)
 */

'use client'

import React, { useState, useEffect } from 'react'
import { formatCurrency } from '@/utils/cost.utils'
import { supabase } from '@/lib/supabase'
import { dispatchToast } from '@/components/ui/ToastProvider'
import { ProjectExpense } from '@/types/database.types'

interface ProjectExpensesProps {
  projectId: string
  expenses: ProjectExpense[]
  onExpensesChanged: () => void  // Callback para recarregar expenses após CUD
}

interface ExpenseFormData {
  description: string
  amount: string
  expense_date: string
  notes: string
}

const emptyForm: ExpenseFormData = {
  description: '',
  amount: '',
  expense_date: '',
  notes: ''
}

function ExpenseRow({
  expense,
  onEdit,
  onDelete
}: {
  expense: ProjectExpense
  onEdit: (expense: ProjectExpense) => void
  onDelete: (expense: ProjectExpense) => void
}) {
  const dateFormatted = expense.expense_date
    ? new Date(expense.expense_date + 'T00:00:00').toLocaleDateString('pt-BR')
    : '—'

  return (
    <tr className="hover:bg-gray-50 group">
      <td className="px-3 py-2 text-sm text-gray-800">{expense.description}</td>
      <td className="px-3 py-2 text-sm font-medium text-blue-800 text-right">{formatCurrency(expense.amount)}</td>
      <td className="px-3 py-2 text-sm text-gray-500 text-center">{dateFormatted}</td>
      <td className="px-3 py-2 text-sm text-gray-400 max-w-[160px] truncate" title={expense.notes ?? ''}>{expense.notes || '—'}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(expense)}
            className="px-2 py-0.5 text-xs text-gray-600 hover:text-blue-600 rounded border border-transparent hover:border-blue-200 hover:bg-blue-50"
          >
            Editar
          </button>
          <button
            onClick={() => onDelete(expense)}
            className="px-2 py-0.5 text-xs text-gray-600 hover:text-red-600 rounded border border-transparent hover:border-red-200 hover:bg-red-50"
          >
            Excluir
          </button>
        </div>
      </td>
    </tr>
  )
}

function ExpenseForm({
  form,
  onChange,
  onSave,
  onCancel,
  isSaving,
  isEditing
}: {
  form: ExpenseFormData
  onChange: (field: keyof ExpenseFormData, value: string) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  isEditing: boolean
}) {
  return (
    <tr className="bg-blue-50 border-t border-blue-200">
      <td className="px-3 py-2">
        <input
          type="text"
          placeholder="Descrição da despesa"
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="0,00"
          value={form.amount}
          onChange={e => onChange('amount', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="date"
          value={form.expense_date}
          onChange={e => onChange('expense_date', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          placeholder="Observações (opcional)"
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          onKeyDown={e => e.key === 'Enter' && onSave()}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1 justify-end">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '...' : (isEditing ? 'Atualizar' : 'Adicionar')}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  )
}

export function ProjectExpenses({
  projectId,
  expenses,
  onExpensesChanged
}: ProjectExpensesProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleFormChange = (field: keyof ExpenseFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setIsAdding(true)
  }

  const handleEdit = (expense: ProjectExpense) => {
    setIsAdding(false)
    setEditingId(expense.id)
    setForm({
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: expense.expense_date ?? '',
      notes: expense.notes ?? ''
    })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.description.trim()) {
      dispatchToast('Informe a descrição da despesa', 'info')
      return
    }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount < 0) {
      dispatchToast('Informe um valor válido', 'info')
      return
    }

    setIsSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('project_expenses')
          .update({
            description: form.description.trim(),
            amount,
            expense_date: form.expense_date || null,
            notes: form.notes.trim() || null
          })
          .eq('id', editingId)

        if (error) throw error
        dispatchToast('Despesa atualizada', 'success')
      } else {
        const { error } = await supabase
          .from('project_expenses')
          .insert({
            project_id: projectId,
            description: form.description.trim(),
            amount,
            expense_date: form.expense_date || null,
            notes: form.notes.trim() || null
          })

        if (error) throw error
        dispatchToast('Despesa adicionada', 'success')
      }

      handleCancel()
      onExpensesChanged()
    } catch (err) {
      console.error('Erro ao salvar despesa:', err)
      dispatchToast('Erro ao salvar despesa', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (expense: ProjectExpense) => {
    if (!window.confirm(`Excluir a despesa "${expense.description}"?`)) return
    setDeletingId(expense.id)
    try {
      const { error } = await supabase
        .from('project_expenses')
        .delete()
        .eq('id', expense.id)

      if (error) throw error
      dispatchToast('Despesa excluída', 'success')
      onExpensesChanged()
    } catch (err) {
      console.error('Erro ao excluir despesa:', err)
      dispatchToast('Erro ao excluir despesa', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">
          Despesas Avulsas
          {expenses.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({expenses.length} item{expenses.length !== 1 ? 's' : ''} · {formatCurrency(total)})
            </span>
          )}
        </span>
        {!isAdding && !editingId && (
          <button
            onClick={handleAdd}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Adicionar
          </button>
        )}
      </div>

      {expenses.length === 0 && !isAdding ? (
        <div className="px-4 py-3 text-xs text-gray-400 italic">
          Nenhuma despesa avulsa cadastrada.
        </div>
      ) : (
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Descrição</th>
              <th className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Valor</th>
              <th className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">Data</th>
              <th className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Observações</th>
              <th className="px-3 py-1.5 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {expenses.map(expense => (
              editingId === expense.id ? (
                <ExpenseForm
                  key={expense.id}
                  form={form}
                  onChange={handleFormChange}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  isSaving={isSaving}
                  isEditing={true}
                />
              ) : (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )
            ))}
            {isAdding && (
              <ExpenseForm
                form={form}
                onChange={handleFormChange}
                onSave={handleSave}
                onCancel={handleCancel}
                isSaving={isSaving}
                isEditing={false}
              />
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
