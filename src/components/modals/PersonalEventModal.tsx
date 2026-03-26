'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Resource } from '@/types/allocation.types'
import {
  CreatePersonalEventDTO,
  EventType,
  EVENT_TYPE_CONFIG,
  PersonalEvent
} from '@/types/personal-events.types'

interface PersonalEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  resources: Resource[]
  selectedResourceId?: string
  selectedDate?: Date
  eventToEdit?: PersonalEvent
}

export default function PersonalEventModal({
  isOpen,
  onClose,
  onSuccess,
  resources,
  selectedResourceId,
  selectedDate,
  eventToEdit
}: PersonalEventModalProps) {
  const [formData, setFormData] = useState<CreatePersonalEventDTO>({
    resource_id: selectedResourceId || '',
    title: '',
    event_type: 'outro',
    start_date: selectedDate ? formatDateToISO(selectedDate) : '',
    end_date: selectedDate ? formatDateToISO(selectedDate) : '',
    is_all_day: true,
    blocks_work: true,
    notes: ''
  })
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Resetar e preencher formulário quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setFormData({
          resource_id: eventToEdit.resource_id,
          title: eventToEdit.title,
          event_type: eventToEdit.event_type,
          start_date: eventToEdit.start_date,
          end_date: eventToEdit.end_date,
          is_all_day: eventToEdit.is_all_day,
          blocks_work: eventToEdit.blocks_work,
          notes: eventToEdit.notes || ''
        })
        setStartTime(eventToEdit.start_time || '')
        setEndTime(eventToEdit.end_time || '')
      } else {
        const dateISO = selectedDate ? formatDateToISO(selectedDate) : ''
        setFormData({
          resource_id: selectedResourceId || '',
          title: '',
          event_type: 'outro',
          start_date: dateISO,
          end_date: dateISO,
          is_all_day: true,
          blocks_work: true,
          notes: ''
        })
        setStartTime('')
        setEndTime('')
      }
      setError(null)
    }
  }, [isOpen, eventToEdit, selectedResourceId, selectedDate])

  function formatDateToISO(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function handleChange(field: keyof CreatePersonalEventDTO, value: any) {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      // Quando marca "dia inteiro", limpa os horários
      if (field === 'is_all_day' && value === true) {
        setStartTime('')
        setEndTime('')
      }
      return next
    })
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!formData.resource_id) {
      setError('Selecione uma pessoa')
      return
    }
    if (!formData.title.trim()) {
      setError('Digite um título para o evento')
      return
    }
    if (!formData.start_date || !formData.end_date) {
      setError('Selecione as datas')
      return
    }
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setError('Data final não pode ser anterior à data inicial')
      return
    }
    if (!formData.is_all_day) {
      if (!startTime || !endTime) {
        setError('Informe o horário de início e fim para evento parcial')
        return
      }
      if (endTime <= startTime) {
        setError('Horário de fim deve ser posterior ao de início')
        return
      }
    }

    setIsSubmitting(true)

    try {
      const payload = {
        title: formData.title,
        event_type: formData.event_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_all_day: formData.is_all_day,
        blocks_work: formData.blocks_work,
        notes: formData.notes || null,
        start_time: !formData.is_all_day && startTime ? startTime : null,
        end_time: !formData.is_all_day && endTime ? endTime : null,
      }

      if (eventToEdit) {
        const { error: updateError } = await supabase
          .from('personal_events')
          .update(payload)
          .eq('id', eventToEdit.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('personal_events')
          .insert([{ ...payload, resource_id: formData.resource_id }])

        if (insertError) throw insertError
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (err) {
      setError('Erro ao salvar evento. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setFormData({
      resource_id: selectedResourceId || '',
      title: '',
      event_type: 'outro',
      start_date: selectedDate ? formatDateToISO(selectedDate) : '',
      end_date: selectedDate ? formatDateToISO(selectedDate) : '',
      is_all_day: true,
      blocks_work: true,
      notes: ''
    })
    setStartTime('')
    setEndTime('')
    setError(null)
  }

  async function handleDelete() {
    if (!eventToEdit) return

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('personal_events')
        .delete()
        .eq('id', eventToEdit.id)

      if (deleteError) throw deleteError

      onSuccess()
      onClose()
      resetForm()
      setShowDeleteConfirm(false)
    } catch (err) {
      setError('Erro ao deletar evento. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleClose() {
    resetForm()
    setShowDeleteConfirm(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {eventToEdit ? '✏️ Editar Evento' : '➕ Adicionar Evento Pessoal'}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Ausências, compromissos e bloqueios de agenda
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Pessoa */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Pessoa *
            </label>
            <select
              value={formData.resource_id}
              onChange={(e) => handleChange('resource_id', e.target.value)}
              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white"
              required
            >
              <option value="">Selecione uma pessoa</option>
              {resources.map(resource => (
                <option key={resource.id} value={resource.id}>
                  {resource.name} - {resource.role}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Evento */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Tipo de Evento *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]).map(([type, config]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleChange('event_type', type)}
                  className={`
                    p-3 rounded-lg border-2 transition-all text-center
                    ${formData.event_type === type
                      ? `${config.bgColor} ${config.borderColor} ${config.color}`
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="text-2xl mb-1">{config.icon}</div>
                  <div className="text-xs font-medium">{config.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Título *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Ex: Consulta médica, Férias, Treinamento..."
              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Descreva brevemente o motivo da ausência
            </p>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Data Início *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Data Fim *
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                min={formData.start_date}
                className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white"
                required
              />
            </div>
          </div>

          {/* Opções */}
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.is_all_day}
                onChange={(e) => handleChange('is_all_day', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <div>
                <span className="text-gray-900 font-medium">Dia inteiro</span>
                <p className="text-xs text-gray-500">
                  Evento ocupa o dia completo
                </p>
              </div>
            </label>

            {/* Horários — visível apenas quando NÃO é dia inteiro */}
            {!formData.is_all_day && (
              <div className="ml-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-3">Horário do evento</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Início *
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => { setStartTime(e.target.value); setError(null) }}
                      className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm"
                      required={!formData.is_all_day}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Fim *
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => { setEndTime(e.target.value); setError(null) }}
                      className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm"
                      required={!formData.is_all_day}
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  A pessoa estará disponível fora deste horário
                </p>
              </div>
            )}

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.blocks_work}
                onChange={(e) => handleChange('blocks_work', e.target.checked)}
                className="w-5 h-5 text-red-600 rounded"
              />
              <div>
                <span className="text-gray-900 font-medium">Bloqueia trabalho</span>
                <p className="text-xs text-gray-500">
                  {formData.is_all_day
                    ? 'Pessoa não estará disponível para tarefas neste período'
                    : 'Exibe aviso ao alocar tarefa neste dia'}
                </p>
              </div>
            </label>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Informações adicionais..."
              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white h-24 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            {eventToEdit && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={isSubmitting}
              >
                🗑️ Deletar
              </button>
            )}

            {showDeleteConfirm && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700 font-medium">Confirmar exclusão?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  Sim, deletar
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
              </div>
            )}

            {!eventToEdit && <div></div>}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Salvando...' : eventToEdit ? 'Salvar Alterações' : 'Adicionar Evento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
