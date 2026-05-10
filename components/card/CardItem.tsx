'use client'

import type { Card } from '@/lib/db'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Edit2, Paperclip, Flame, ArrowUp, Minus, ArrowDown, ImageIcon } from 'lucide-react'
import { memo, useState } from 'react'

interface CardItemProps {
  card: Card
  isDragging?: boolean
  onEdit?: (card: Card) => void
  selected?: boolean
  selectionMode?: boolean
  onSelectToggle?: (cardId: string) => void
  onSelectRange?: (toCardId: string) => void
}

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false
  const date = new Date(dueDate)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return date < now
}

function formatDueDate(dueDate?: string): string {
  if (!dueDate) return ''
  const date = new Date(dueDate)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function PriorityIcon({ priority }: { priority?: string }) {
  if (priority === 'urgent') {
    return <Flame className="h-3 w-3 text-red-500" />
  }
  if (priority === 'high') {
    return <ArrowUp className="h-3 w-3 text-orange-500" />
  }
  if (priority === 'medium') {
    return <Minus className="h-3 w-3 text-yellow-500" />
  }
  if (priority === 'low') {
    return <ArrowDown className="h-3 w-3 text-green-500" />
  }
  return null
}

function PriorityLabel({ priority }: { priority?: string }) {
  const map: Record<string, string> = {
    urgent: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  }
  if (!priority || !map[priority]) return null
  return <span className="text-[10px]">{map[priority]}</span>
}

export const CardItem = memo(function CardItem({
  card,
  isDragging,
  onEdit,
  selected,
  selectionMode,
  onSelectToggle,
  onSelectRange,
}: CardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const overdue = isOverdue(card.dueDate)

  return (
    <div
      className={cn(
        'pixel-office-card group relative rounded-lg border border-border bg-card p-2.5 shadow-sm transition-all duration-150 hover:border-ring/25 hover:shadow-md hover:-translate-y-px',
        isDragging && 'opacity-50',
        overdue && 'border-l-2 border-l-red-500',
        selected && 'border-primary ring-2 ring-primary/10',
        (card as Card & { _matches?: boolean })._matches === false && 'opacity-40'
      )}
      onDoubleClick={() => {
        if (!selectionMode && onEdit) onEdit(card)
      }}
      onClick={(e) => {
        if (selectionMode) {
          e.stopPropagation()
          onSelectToggle?.(card.id)
          return
        }
        if (e.metaKey || e.ctrlKey) {
          e.stopPropagation()
          onSelectToggle?.(card.id)
          return
        }
        if (e.shiftKey && onSelectRange) {
          e.stopPropagation()
          onSelectRange(card.id)
          return
        }
      }}
    >
      {/* 选择模式 Checkbox */}
      {selectionMode && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation()
              onSelectToggle?.(card.id)
            }}
            className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
            aria-label={`选择卡片 ${card.title}`}
          />
        </div>
      )}

      {/* 操作按钮 */}
      {onEdit && !selectionMode && (
        <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(card)
            }}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="编辑"
            aria-label="编辑卡片"
          >
            <Edit2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 标签 */}
      {card.tags && card.tags.length > 0 && (
        <div className={cn('mb-2 flex flex-wrap gap-1', selectionMode && 'pl-6')}>
          {card.tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="h-4 rounded-sm border-0 px-1.5 py-0 text-[10px] font-medium"
              style={{
                backgroundColor: tag.color + '16',
                color: tag.color,
              }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* 标题 */}
      <h3 className={cn('mb-1.5 pr-4 text-sm font-medium leading-snug text-foreground', selectionMode && 'pl-6')}>
        {card.title}
      </h3>

      {/* 描述 */}
      {card.description && (
        <p
          className={cn(
            'mb-2 text-xs leading-relaxed text-muted-foreground',
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
          className="mb-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? '收起' : '展开'}
        </button>
      )}

      {/* 附件预览 */}
      {card.attachments && card.attachments.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5">
          {card.attachments.slice(0, 3).map((att) => (
            <div
              key={att.id}
              className="flex h-5 items-center gap-1 rounded bg-muted px-1.5 text-[10px] text-muted-foreground"
              title={att.originalName}
            >
              {att.mimeType.startsWith('image/') ? (
                <ImageIcon className="h-3 w-3 shrink-0" />
              ) : (
                <Paperclip className="h-3 w-3 shrink-0" />
              )}
              <span className="max-w-[60px] truncate">{att.originalName}</span>
            </div>
          ))}
          {card.attachments.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{card.attachments.length - 3}</span>
          )}
        </div>
      )}

      {/* 底部信息 */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <time dateTime={card.createdAt}>{formatRelativeTime(new Date(card.createdAt))}</time>
          {card.dueDate && (
            <span className={cn('flex items-center gap-0.5', overdue && 'text-red-500 font-medium')}>
              {overdue && <span className="text-red-500">已过期</span>}
              <span>{formatDueDate(card.dueDate)}</span>
            </span>
          )}
          {card.attachments && card.attachments.length > 0 && (
            <span className="flex items-center gap-0.5" title={`${card.attachments.length} 个附件`}>
              <Paperclip className="h-3 w-3" />
              {card.attachments.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {card.priority && (
            <span className="flex items-center gap-0.5">
              <PriorityIcon priority={card.priority} />
              <PriorityLabel priority={card.priority} />
            </span>
          )}
          {card.updatedAt !== card.createdAt && (
            <span className="text-[9px]">已编辑</span>
          )}
        </div>
      </div>
    </div>
  )
})
