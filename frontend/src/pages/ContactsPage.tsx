import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Star } from 'lucide-react'
import { supabaseApi, getErrorMessage } from '../api/supabase'
import { Contact } from '../types'
import { ContactCard } from '../components/contacts/ContactCard'
import { ContactForm } from '../components/contacts/ContactForm'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { SearchField } from '../components/common/SearchField'
import { cn } from '../utils/cn'

const ContactsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [showFavorites, setShowFavorites] = useState(false)
  const queryClient = useQueryClient()

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', appliedSearch, showFavorites],
    queryFn: () => supabaseApi.contacts.getAll({
      search: appliedSearch || undefined,
      isFavorite: showFavorites || undefined
    })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supabaseApi.contacts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Контакт удален')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Ошибка удаления')
    }
  })

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      supabaseApi.contacts.update(id, { isFavorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: () => {
      toast.error('Ошибка обновления избранного')
    }
  })

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] })
    setEditingContact(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Контакты</h1>
          <p className="text-gray-500 text-sm">
            {contacts?.length || 0} контактов
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingContact(null)
            setShowForm(true)
          }}
          className="flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Новый контакт
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          onSearch={() => setAppliedSearch(searchInput.trim())}
          placeholder="Поиск по имени, телефону, email..."
        />
        <button
          type="button"
          onClick={() => setShowFavorites(!showFavorites)}
          className={cn(
            'px-4 py-2 rounded-lg border flex items-center gap-2 transition-colors',
            showFavorites
              ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
              : 'border-gray-300 hover:bg-gray-50'
          )}
        >
          <Star className={cn(
            'w-4 h-4',
            showFavorites ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
          )} />
          Избранные
        </button>
      </div>

      {contacts && contacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleEdit}
              onDelete={deleteMutation.mutate}
              onToggleFavorite={(id, isFavorite) =>
                toggleFavoriteMutation.mutate({ id, isFavorite })
              }
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Нет контактов</p>
          <p className="text-gray-400 text-sm mt-1">
            {appliedSearch ? 'Попробуйте изменить поиск' : 'Создайте первый контакт'}
          </p>
        </div>
      )}

      <ContactForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingContact(null)
        }}
        onSuccess={handleFormSuccess}
        contact={editingContact || undefined}
      />
    </div>
  )
}

export default ContactsPage
