import React from 'react'
import { Category } from '../../types'
import { getSiblingMoveFlags, hasDirectChildren } from '../../utils/categoryTree'
import { CategoryCard } from './CategoryCard'

interface CategoryTreeListProps {
  nodes: Category[]
  allCategories: Category[]
  depth?: number
  collapsedIds: Set<string>
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
  collapsedIds,
  onToggleCollapse,
  onEdit,
  onDelete,
  onMove,
  isMoving
}) => (
  <div className={depth > 0 ? 'ml-3 sm:ml-4 space-y-1' : 'space-y-1'}>
    {nodes.map((category) => {
      const hasChildren = hasDirectChildren(allCategories, category.id)
      const isCollapsed = hasChildren && collapsedIds.has(category.id)
      const { canMoveUp, canMoveDown } = getSiblingMoveFlags(allCategories, category.id)

      const childNodes = hasChildren
        ? allCategories
            .filter((c) => c.parentId === category.id)
            .sort((a, b) => {
              const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
              return order !== 0 ? order : a.name.localeCompare(b.name, 'ru')
            })
        : []

      return (
        <div key={category.id}>
          <CategoryCard
            category={category}
            depth={depth}
            hasChildren={hasChildren}
            isCollapsed={isCollapsed}
            childCount={childNodes.length}
            canMoveUp={canMoveUp && !isMoving}
            canMoveDown={canMoveDown && !isMoving}
            onToggleCollapse={hasChildren ? () => onToggleCollapse(category.id) : undefined}
            onEdit={onEdit}
            onDelete={onDelete}
            onMoveUp={(id) => onMove(id, 'up')}
            onMoveDown={(id) => onMove(id, 'down')}
          />
          {hasChildren && !isCollapsed && childNodes.length > 0 && (
            <CategoryTreeList
              nodes={childNodes}
              allCategories={allCategories}
              depth={depth + 1}
              collapsedIds={collapsedIds}
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
