'use client'

import { createPortal } from 'react-dom'
import { Command, FileText, CornerDownLeft, ArrowUp, ArrowDown, CornerUpLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SlashMenuItem {
  key: string
  label: string
  description?: string
  insertText: string
  kind?: 'tool' | 'snippet'
}

interface SlashCommandMenuProps {
  open: boolean
  anchor: { left: number; width: number; bottom: number } | null
  items: SlashMenuItem[]
  activeIndex: number
  onSelect: (item: SlashMenuItem) => void
  onActiveIndexChange: (index: number) => void
  onDismiss: () => void
}

export function SlashCommandMenu({
  open,
  anchor,
  items,
  activeIndex,
  onSelect,
  onActiveIndexChange,
}: SlashCommandMenuProps) {
  if (!open || !anchor) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: anchor.left,
        width: anchor.width,
        bottom: anchor.bottom,
      }}
      className="z-[9999] animate-menu-pop"
    >
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xl shadow-black/10">
        <div className="max-h-60 overflow-y-auto py-1">
          {items.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              tabIndex={-1}
              className={cn(
                'group relative w-full px-3 py-2 text-left transition-colors duration-150',
                'hover:bg-muted/60',
                idx === activeIndex && 'bg-accent/80'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => onActiveIndexChange(idx)}
              onClick={() => onSelect(item)}
            >
              {/* 左侧高亮指示器 */}
              <div
                className={cn(
                  'absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-150',
                  idx === activeIndex ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                  background: item.kind === 'tool'
                    ? 'linear-gradient(to bottom, #f59e0b, #ef4444)'
                    : 'linear-gradient(to bottom, #3b82f6, #8b5cf6)'
                }}
              />

              <div className="flex items-center gap-2.5">
                {/* 图标 */}
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                  idx === activeIndex ? 'bg-white shadow-sm' : 'bg-muted/60'
                )}>
                  {item.kind === 'tool' ? (
                    <Command className="h-3.5 w-3.5 text-amber-600" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'truncate text-sm font-medium',
                      idx === activeIndex ? 'text-foreground' : 'text-foreground/90'
                    )}>
                      {item.label}
                    </span>
                    {/* 类型标签 */}
                    <span className={cn(
                      'rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wider',
                      item.kind === 'tool'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                    )}>
                      {item.kind === 'tool' ? '工具' : '模板'}
                    </span>
                  </div>
                  {item.description && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  )}
                </div>

                {/* 快捷键提示 */}
                <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground/60">
                  {idx === activeIndex && (
                    <CornerDownLeft className="h-3 w-3" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 底部快捷键提示 */}
        <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-3 py-1.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            <span>选择</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <CornerDownLeft className="h-3 w-3" />
            <span>确认</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <CornerUpLeft className="h-3 w-3" />
            <span>关闭</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
