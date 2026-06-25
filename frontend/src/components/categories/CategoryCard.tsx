import React from 'react'
import { Edit2, Trash2, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { Category } from '../../types'
import { cn } from '../../utils/cn'

interface CategoryCardProps {
  category: Category
  depth?: number
  canMoveUp?: boolean
  canMoveDown?: boolean
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  depth = 0,
  canMoveUp = false,
  canMoveDown = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown
}) => {
  const canEdit = !category.isSystem
  const hasChildren = (category.children?.length ?? 0) > 0

  const handleCardClick = () => {
    if (canEdit) onEdit(category)
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-3 sm:p-4 shadow-sm transition-shadow',
        canEdit && 'cursor-pointer active:bg-gray-50 hover:shadow-md',
        depth > 0 && 'border-l-4 border-l-primary-200',
        category.isSystem && 'opacity-75 bg-gray-50'
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
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {depth > 0 && (
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          )}
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-lg sm:text-xl shrink-0"
            style={{ backgroundColor: category.color || '#E5E7EB' }}
          >
            {category.icon || '📁'}
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 truncate text-sm sm:text-base">{category.name}</h4>
            <p className="text-xs text-gray-500">
              {category.isSystem && 'Системная'}
              {!category.isSystem && hasChildren && `${category.children!.length} подкат.`}
              {!category.isSystem && !hasChildren && depth > 0 && 'Подкатегория'}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={(e) => {
                e.stopPropagation()
                onMoveUp?.(category.id)
              }}
              className={cn(
                'p-2 rounded-lg transition-colors',
                canMoveUp
                  ? 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                  : 'text-gray-200 cursor-not-allowed'
              )}
              title="Выше"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={(e) => {
                e.stopPropagation()
                onMoveDown?.(category.id)
              }}
              className={cn(
                'p-2 rounded-lg transition-colors',
                canMoveDown
                  ? 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                  : 'text-gray-200 cursor-not-allowed'
              )}
              title="Ниже"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(category)
              }}
              className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
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
              className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
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
