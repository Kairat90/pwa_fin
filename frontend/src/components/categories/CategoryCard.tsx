import React from 'react'
import { Edit2, Trash2, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react'
import { Category } from '../../types'
import { cn } from '../../utils/cn'
import { ICON_16 } from '../../utils/iconSize'

interface CategoryCardProps {
  category: Category
  depth?: number
  hasChildren?: boolean
  isCollapsed?: boolean
  childCount?: number
  canMoveUp?: boolean
  canMoveDown?: boolean
  onToggleCollapse?: () => void
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  depth = 0,
  hasChildren = false,
  isCollapsed = false,
  childCount = 0,
  canMoveUp = false,
  canMoveDown = false,
  onToggleCollapse,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown
}) => {
  const canEdit = !category.isSystem

  const handleCardClick = () => {
    if (hasChildren) {
      onToggleCollapse?.()
      return
    }
    if (canEdit) onEdit(category)
  }

  return (
    <div
      className={cn(
        'bg-white rounded-lg border px-2 py-1.5 shadow-sm transition-shadow',
        (canEdit || hasChildren) && 'cursor-pointer active:bg-gray-50 hover:shadow-md',
        depth > 0 && 'border-l-2 border-l-primary-200',
        category.isSystem && 'opacity-75 bg-gray-50'
      )}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if ((canEdit || hasChildren) && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleCardClick()
        }
      }}
      role={canEdit || hasChildren ? 'button' : undefined}
      tabIndex={canEdit || hasChildren ? 0 : undefined}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleCollapse?.()
              }}
              className="p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded shrink-0"
              title={isCollapsed ? 'Развернуть' : 'Свернуть'}
              aria-expanded={!isCollapsed}
            >
              <ChevronRight
                className={cn(ICON_16, 'transition-transform', !isCollapsed && 'rotate-90')}
              />
            </button>
          ) : (
            <span className="w-4 shrink-0" aria-hidden />
          )}

          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: category.color || '#E5E7EB' }}
            aria-hidden
          />

          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 truncate text-sm leading-tight">{category.name}</h4>
            {(category.isSystem || (hasChildren && isCollapsed)) && (
              <p className="text-[10px] text-gray-400 leading-tight">
                {category.isSystem && 'Системная'}
                {category.isSystem && hasChildren && isCollapsed && ' · '}
                {hasChildren && isCollapsed && `${childCount} подкат.`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={(e) => {
              e.stopPropagation()
              onMoveUp?.(category.id)
            }}
            className={cn(
              'p-0.5 rounded transition-colors',
              canMoveUp
                ? 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                : 'text-gray-200 cursor-not-allowed'
            )}
            title="Выше"
          >
            <ChevronUp className={ICON_16} />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={(e) => {
              e.stopPropagation()
              onMoveDown?.(category.id)
            }}
            className={cn(
              'p-0.5 rounded transition-colors',
              canMoveDown
                ? 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                : 'text-gray-200 cursor-not-allowed'
            )}
            title="Ниже"
          >
            <ChevronDown className={ICON_16} />
          </button>

          {canEdit && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(category)
                }}
                className="p-0.5 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50 transition-colors"
                title="Редактировать"
              >
                <Edit2 className={ICON_16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(category.id)
                }}
                className="p-0.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                title="Удалить"
              >
                <Trash2 className={ICON_16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
