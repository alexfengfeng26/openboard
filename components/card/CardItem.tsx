'use client'

import type { Card } from '@/lib/db'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Edit2 } from 'lucide-react'
import { useState } from 'react'

interface CardItemProps {
  card: Card
  isDragging?: boolean
  onEdit?: (card: Card) => void
}

export function CardItem({ card, isDragging, onEdit }: CardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className={cn(
        'rounded-md border bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md group relative',
        isDragging && 'react-kanban-dragging'
      )}
      onDoubleClick={() => onEdit && onEdit(card)}
    >
      {/* 操作按钮 */}
      {onEdit && (
        <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(card)
            }}
            className="rounded p-0.5 hover:bg-muted text-muted-foreground"
            title="编辑"
          >
            <Edit2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 标签 */}
      {card.tags && card.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-[10px] h-5 px-1.5 py-0.5"
              style={{
                backgroundColor: tag.color + '20',
                color: tag.color,
                border: `1px solid ${tag.color}40`,
              }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* 标题 */}
      <h3 className="mb-1.5 text-sm font-medium leading-tight text-foreground">{card.title}</h3>

      {/* 描述 */}
      {card.description && (
        <p
          className={cn(
            'mb-2 text-xs text-muted-foreground leading-relaxed',
            !isExpanded && 'line-clamp-3'
          )}
        >
          {card.description}
        </p>
      )}

      {/* 展开/收起按钮 */}
      {card.description && card.description.length > 100 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[10px] text-muted-foreground hover:text-foreground mb-1.5"
        >
          {isExpanded ? '收起' : '展开'}
        </button>
      )}

      {/* 底部信息 */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <time dateTime={card.createdAt}>{formatRelativeTime(new Date(card.createdAt))}</time>
        {card.updatedAt !== card.createdAt && (
          <span className="text-[9px]">已编辑</span>
        )}
      </div>
    </div>
  )
}
