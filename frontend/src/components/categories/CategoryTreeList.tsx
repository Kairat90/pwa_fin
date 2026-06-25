import React from 'react'
import { Category } from '../../types'
import { getSiblingMoveFlags } from '../../utils/categoryTree'
import { CategoryCard } from './CategoryCard'

interface CategoryTreeListProps {
  nodes: Category[]
  allCategories: Category[]
  depth?: number
  expandedIds: Set<string>
  onToggleCollapse: (id: string) => void
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  isMoving: boolean
}

/** Рекурсивный список категорий с сворачиванием родителей */
export const CategoryTreeList: React.FC<CategoryTreeListProps> = ({
  nodes,
  allCategories,
  depth = 0,
  expandedIds,
  onToggleCollapse,
  onEdit,
  onDelete,
  onMove,
  isMoving
}) => (
  <div className={depth > 0 ? 'ml-3 sm:ml-4 space-y-1.5' : 'space-y-1.5'}>
    {nodes.map((category) => {
      const hasChildren = (category.children?.length ?? 0) > 0
      const isCollapsed = hasChildren && !expandedIds.has(category.id)
      const { canMoveUp, canMoveDown } = getSiblingMoveFlags(allCategories, category.id)

      return (
        <div key={category.id}>
          <CategoryCard
            category={category}
            depth={depth}
            hasChildren={hasChildren}
            isCollapsed={isCollapsed}
            childCount={category.children?.length ?? 0}
            canMoveUp={canMoveUp && !isMoving}
            canMoveDown={canMoveDown && !isMoving}
            onToggleCollapse={hasChildren ? () => onToggleCollapse(category.id) : undefined}
            onEdit={onEdit}
            onDelete={onDelete}
            onMoveUp={(id) => onMove(id, 'up')}
            onMoveDown={(id) => onMove(id, 'down')}
          />
          {hasChildren && !isCollapsed && (
            <CategoryTreeList
              nodes={category.children!}
              allCategories={allCategories}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleCollapse={onToggleCollapse}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              isMoving={isMoving}
            />
          )}
        </div>
      )
    })}
  </div>
)
