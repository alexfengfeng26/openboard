'use client'

import { useState, useMemo } from 'react'
import { useIconSettings } from '@/lib/hooks/useSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Image, X } from 'lucide-react'

interface BoardIconPickerProps {
  selectedIcon?: string | null
  onSelect: (iconUrl: string | null) => void
}

export function BoardIconPicker({ selectedIcon, onSelect }: BoardIconPickerProps) {
  const { icons, loading } = useIconSettings()
  const [searchQuery, setSearchQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) return icons
    return icons.filter((icon) =>
      icon.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [icons, searchQuery])

  const selectedIconData = icons.find((i) => i.url === selectedIcon)

  return (
    <div className="space-y-2">
      {/* 当前选择展示 */}
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors hover:border-ring/30 hover:bg-muted/50"
          onClick={() => setExpanded(!expanded)}
          title="选择图标"
        >
          {selectedIconData ? (
            <img
              src={selectedIconData.url}
              alt={selectedIconData.name}
              className="max-h-6 max-w-6 object-contain"
            />
          ) : (
            <Image className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {selectedIconData ? selectedIconData.name : '选择图标'}
        </Button>
        {selectedIcon && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground"
            onClick={() => onSelect(null)}
            title="清除图标"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* 展开的选择面板 */}
      {expanded && (
        <div className="rounded-md border p-3">
          <Input
            type="text"
            placeholder="搜索图标..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3 h-8 text-sm"
            autoFocus
          />

          {loading ? (
            <p className="text-center text-xs text-muted-foreground">加载中...</p>
          ) : filteredIcons.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              {icons.length === 0 ? '暂无可用图标，请先在设置中上传' : '没有匹配的图标'}
            </p>
          ) : (
            <div className="grid grid-cols-6 gap-2">
              {filteredIcons.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  onClick={() => {
                    onSelect(icon.url)
                    setExpanded(false)
                    setSearchQuery('')
                  }}
                  className={`flex flex-col items-center gap-1 rounded-md border p-2 transition-colors ${
                    selectedIcon === icon.url
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-ring/30 hover:bg-muted/50'
                  }`}
                  title={icon.name}
                >
                  <img
                    src={icon.url}
                    alt={icon.name}
                    className="max-h-6 max-w-6 object-contain"
                  />
                  <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                    {icon.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
