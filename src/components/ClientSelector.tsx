'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ClientOption } from '@/types/client.types'

interface ClientSelectorProps {
  value: string | null
  onSelect: (clientName: string, logoUrl: string | null) => void
  placeholder?: string
  className?: string
}

/**
 * ClientSelector - Combobox híbrido para selecionar ou criar clientes
 *
 * Comportamento:
 * - Digita: busca clientes existentes em tempo real
 * - Encontrou: seleciona da lista
 * - Não encontrou: cria novo cliente
 */
export default function ClientSelector({
  value,
  onSelect,
  placeholder = 'Digite o nome do cliente...',
  className = '',
}: ClientSelectorProps) {
  const [inputValue, setInputValue] = useState(value || '')
  const [clients, setClients] = useState<ClientOption[]>([])
  const [filteredClients, setFilteredClients] = useState<ClientOption[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch all clients on mount
  useEffect(() => {
    fetchClients()
  }, [])

  // Sync input with external value changes
  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  // Filter clients as user types
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredClients(clients)
      return
    }

    const searchTerm = inputValue.toLowerCase()
    const filtered = clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm)
    )
    setFilteredClients(filtered)
    setSelectedIndex(-1)
  }, [inputValue, clients])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchClients() {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, logo_url')
        .order('name')

      if (error) throw error
      setClients(data || [])
      setFilteredClients(data || [])
    } catch (error) {
      console.error('Erro ao buscar clientes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function createNewClient(name: string) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({ name })
        .select('id, name, logo_url')
        .single()

      if (error) throw error

      // Add to local state
      setClients(prev => [...prev, data])
      return data
    } catch (error) {
      console.error('Erro ao criar cliente:', error)
      return null
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    setInputValue(newValue)
    setIsOpen(true)
  }

  function handleInputFocus() {
    setIsOpen(true)
  }

  async function handleSelectClient(client: ClientOption) {
    setInputValue(client.name)
    setIsOpen(false)
    onSelect(client.name, client.logo_url)
  }

  async function handleCreateNew() {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue) return

    // Check if client already exists (case insensitive)
    const existingClient = clients.find(
      c => c.name.toLowerCase() === trimmedValue.toLowerCase()
    )

    if (existingClient) {
      handleSelectClient(existingClient)
      return
    }

    // Create new client
    const newClient = await createNewClient(trimmedValue)
    if (newClient) {
      setInputValue(newClient.name)
      setIsOpen(false)
      onSelect(newClient.name, newClient.logo_url)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return

    const options = [...filteredClients]
    const showCreateOption = inputValue.trim() && filteredClients.length === 0

    if (showCreateOption) {
      // Only "Create new" option available
      if (e.key === 'Enter') {
        e.preventDefault()
        handleCreateNew()
      }
      return
    }

    // Navigate through existing options
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < options.length) {
        handleSelectClient(options[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const showCreateOption = inputValue.trim() && filteredClients.length === 0
  const showExistingOptions = filteredClients.length > 0

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
        disabled={isLoading}
      />

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Carregando clientes...
            </div>
          )}

          {!isLoading && showExistingOptions && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">
                Clientes existentes
              </div>
              {filteredClients.map((client, index) => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                    index === selectedIndex ? 'bg-blue-50' : ''
                  }`}
                >
                  {client.logo_url ? (
                    <img
                      src={client.logo_url}
                      alt={client.name}
                      className="w-6 h-6 rounded object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-gray-900">{client.name}</span>
                </button>
              ))}
            </div>
          )}

          {!isLoading && showCreateOption && (
            <button
              onClick={handleCreateNew}
              className="w-full text-left px-4 py-3 text-sm hover:bg-green-50 transition-colors flex items-center gap-2 border-t"
            >
              <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center">
                <span className="text-green-600 font-bold">+</span>
              </div>
              <div>
                <div className="text-gray-900 font-medium">
                  Criar novo: <span className="text-green-600">{inputValue.trim()}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Pressione Enter ou clique para criar
                </div>
              </div>
            </button>
          )}

          {!isLoading && !showExistingOptions && !showCreateOption && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Digite o nome do cliente para buscar ou criar novo
            </div>
          )}
        </div>
      )}
    </div>
  )
}
