import React from 'react'
import { Edit2, Trash2, ChevronRight } from 'lucide-react'
import { Category } from '../../types'
import { cn } from '../../utils/cn'

interface CategoryCardProps {
  category: Category
  depth?: number
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  depth = 0,
  onEdit,
  onDelete
}) => {
  const canEdit = !category.isSystem
  const hasChildren = (category.children?.length ?? 0) > 0

  const handleCardClick = () => {
    if (canEdit) onEdit(category)
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-4 shadow-sm transition-shadow',
        canEdit && 'cursor-pointer active:bg-gray-50 hover:shadow-md',
        depth > 0 && 'border-l-4 border-l-primary-200'
      )}
      style={{ marginLeft: depth > 0 ? `${depth * 12}px` : undefined }}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onEdit(category)
        }
      }}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {depth > 0 && (
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          )}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: category.color || '#E5E7EB' }}
          >
            {category.icon || '📁'}
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 truncate">{category.name}</h4>
            <p className="text-xs text-gray-500">
              {category.type === 'income' ? 'Доход' : 'Расход'}
              {category.isSystem && ' • Системная'}
              {hasChildren && ` • ${category.children!.length} подкат.`}
            </p>
            {category.parent?.name && (
              <p className="text-xs text-gray-400 truncate">
                Группа: {category.parent.name}
              </p>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(category)
              }}
              className="p-2.5 md:p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
              title="Редактировать"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(category.id)
              }}
              className="p-2.5 md:p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
