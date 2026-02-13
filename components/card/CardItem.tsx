'use client'

import type { Card } from '@/lib/db'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Edit2, Calendar } from 'lucide-react'
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
        'group relative rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-sm',
        'transition-all duration-200 ease-out',
        'hover:border-indigo-300/60 hover:shadow-md hover:-translate-y-0.5',
        isDragging && 'react-kanban-dragging opacity-60'
      )}
      onDoubleClick={() => onEdit && onEdit(card)}
    >
      {/* 左侧装饰条 - 根据优先级或标签颜色 */}
      {card.tags && card.tags.length > 0 && (
        <div 
          className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
          style={{ backgroundColor: card.tags[0]?.color || '#6366f1' }}
        />
      )}

      {/* 操作按钮 */}
      {onEdit && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(card)
            }}
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/90 shadow-sm border border-slate-200/60 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:shadow-md transition-all"
            title="编辑"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 标签 */}
      {card.tags && card.tags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5 pl-2">
          {card.tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-[10px] h-5 px-2 py-0 font-medium rounded-full"
              style={{
                backgroundColor: tag.color + '15',
                color: tag.color,
                border: `1px solid ${tag.color}25`,
              }}
            >
              {tag.name}
            </Badge>
          ))}
          {card.tags.length > 3 && (
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-2 py-0 font-medium rounded-full bg-slate-100 text-slate-500"
            >
              +{card.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* 标题 */}
      <h3 className={cn(
        "mb-2 text-sm font-semibold leading-snug text-slate-800 pl-2",
        "group-hover:text-indigo-700 transition-colors"
      )}>
        {card.title}
      </h3>

      {/* 描述 */}
      {card.description && (
        <p
          className={cn(
            'mb-3 text-xs text-slate-500 leading-relaxed pl-2',
            !isExpanded && 'line-clamp-2'
          )}
        >
          {card.description}
        </p>
      )}

      {/* 展开/收起按钮 */}
      {card.description && card.description.length > 80 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium mb-2 pl-2 transition-colors"
        >
          {isExpanded ? '收起' : '展开'}
        </button>
      )}

      {/* 底部信息 */}
      <div className="flex items-center justify-between pl-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Calendar className="h-3 w-3" />
          <time dateTime={card.createdAt}>{formatRelativeTime(new Date(card.createdAt))}</time>
        </div>
        {card.updatedAt !== card.createdAt && (
          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            已编辑
          </span>
        )}
      </div>
    </div>
  )
}
