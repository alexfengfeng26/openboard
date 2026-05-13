'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Template } from '@/types/template.types'
import { Layout, FileText, Bug, Rocket, Tag, Zap, Bot, Copy, Pencil, Trash2, Check } from 'lucide-react'

const ICON_MAP: Record<string, React.ReactNode> = {
  Layout: <Layout className="h-5 w-5" />,
  Rocket: <Rocket className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Bug: <Bug className="h-5 w-5" />,
  Tag: <Tag className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
  Bot: <Bot className="h-5 w-5" />,
  Users: <Layout className="h-5 w-5" />,
  Code: <FileText className="h-5 w-5" />,
  Lightbulb: <Zap className="h-5 w-5" />,
}

interface TemplateCardProps {
  template: Template
  selected?: boolean
  onSelect?: (template: Template) => void
  onEdit?: (template: Template) => void
  onDelete?: (template: Template) => void
  onClone?: (template: Template) => void
  showActions?: boolean
}

export function TemplateCard({
  template,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onClone,
  showActions = true,
}: TemplateCardProps) {
  const { meta } = template
  const icon = ICON_MAP[meta.icon || ''] || <Layout className="h-5 w-5" />

  return (
    <div
      role={!showActions && onSelect ? 'button' : undefined}
      tabIndex={!showActions && onSelect ? 0 : undefined}
      onClick={!showActions && onSelect ? () => onSelect(template) : undefined}
      onKeyDown={!showActions && onSelect ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(template)
        }
      } : undefined}
      className={cn(
        'relative flex flex-col gap-2 rounded-lg border p-3 transition-all',
        !showActions && onSelect && 'cursor-pointer',
        selected
          ? 'border-ring/40 bg-muted ring-1 ring-ring/20'
          : 'border-border bg-card hover:border-ring/30 hover:bg-muted/50'
      )}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}

      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{meta.name}</span>
            {meta.builtin && (
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                内置
              </span>
            )}
          </div>
          {meta.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{meta.description}</p>
          )}
        </div>
      </div>

      {meta.tags && meta.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {meta.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {showActions && (
        <div className="flex items-center gap-1.5 pt-1">
          {onSelect && (
            <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => onSelect(template)}>
              使用
            </Button>
          )}
          {meta.builtin ? (
            onClone && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 flex-1 gap-1 text-xs"
                onClick={() => onClone(template)}
              >
                <Copy className="h-3 w-3" />
                复制
              </Button>
            )
          ) : (
            <>
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => onEdit(template)}
                >
                  <Pencil className="h-3 w-3" />
                  编辑
                </Button>
              )}
              {onDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(template)}
                >
                  <Trash2 className="h-3 w-3" />
                  删除
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
