'use client'

import { createPortal } from 'react-dom'

export interface SlashMenuItem {
  key: string
  label: string
  description?: string
  insertText: string
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
      className="z-[9999] overflow-hidden rounded-md border bg-background shadow-lg"
    >
      <div className="max-h-56 overflow-y-auto p-1">
        {items.map((item, idx) => (
          <button
            key={item.key}
            type="button"
            tabIndex={-1}
            className={[
              'w-full rounded-md px-2 py-1.5 text-left text-sm',
              idx === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            ].join(' ')}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onActiveIndexChange(idx)}
            onClick={() => onSelect(item)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate font-medium">{item.label}</div>
              <div className="text-[11px] text-muted-foreground">Enter</div>
            </div>
            {item.description && (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.description}</div>
            )}
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}
