import React from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { Category } from '../../types'

interface CategoryCardProps {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  onEdit,
  onDelete
}) => {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: category.color || '#E5E7EB' }}
          >
            {category.icon || '📁'}
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{category.name}</h4>
            <p className="text-xs text-gray-500">
              {category.type === 'income' ? 'Доход' : 'Расход'}
              {category.isSystem && ' • Системная'}
            </p>
          </div>
        </div>
        {!category.isSystem && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(category)}
              className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
              title="Редактировать"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(category.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      {category.parentId && (
        <p className="text-xs text-gray-400 mt-1">
          Родительская: {category.parent?.name || 'Не указана'}
        </p>
      )}
    </div>
  )
}
