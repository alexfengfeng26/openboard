'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTagsSettings } from '@/lib/hooks/useTagsSettings'
import { toastError, toastSuccess } from '@/components/ui/toast'
import type { Tag } from '@/types/card.types'

/**
 * 标签设置面板（用于设置对话框内）
 */
export function TagSettingsPanel() {
  const {
    tags,
    colorOptions,
    loading,
    addTag,
    updateTag,
    removeTag,
  } = useTagsSettings()

  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(colorOptions[0] || '#6b7280')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      toastError('标签名称不能为空')
      return
    }
    
    try {
      await addTag(newTagName.trim(), newTagColor)
      toastSuccess('标签添加成功')
      setNewTagName('')
    } catch (error) {
      toastError(error instanceof Error ? error.message : '添加标签失败')
    }
  }

  const handleUpdateTag = async () => {
    if (!editingTag) return
    if (!editingTag.name.trim()) {
      toastError('标签名称不能为空')
      return
    }
    
    try {
      await updateTag(editingTag.id, {
        name: editingTag.name.trim(),
        color: editingTag.color,
      })
      toastSuccess('标签更新成功')
      setEditingTag(null)
    } catch (error) {
      toastError(error instanceof Error ? error.message : '更新标签失败')
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTag(tagId)
      toastSuccess('标签删除成功')
    } catch (error) {
      toastError('删除标签失败')
    }
  }

  return (
    <div className="space-y-4 py-4">
      {/* 添加新标签 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">添加新标签</h3>
        <div className="flex gap-2">
          <Input
            placeholder="标签名称"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddTag()
              }
            }}
          />
          <div className="flex items-center gap-1">
            {colorOptions.slice(0, 6).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewTagColor(color)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  newTagColor === color ? 'border-slate-900 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <Button
            size="sm"
            onClick={handleAddTag}
            disabled={loading || !newTagName.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* 更多颜色选项 */}
        <div className="flex flex-wrap gap-1 pt-1">
          {colorOptions.slice(6).map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setNewTagColor(color)}
              className={`w-5 h-5 rounded-full border transition-all ${
                newTagColor === color ? 'border-slate-900 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* 现有标签列表 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">现有标签 ({tags.length})</h3>
        <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              {editingTag?.id === tag.id ? (
                // 编辑模式
                <>
                  <Input
                    value={editingTag.name}
                    onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                    className="flex-1 h-8"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateTag()
                      } else if (e.key === 'Escape') {
                        setEditingTag(null)
                      }
                    }}
                  />
                  <div className="flex items-center gap-1">
                    {colorOptions.slice(0, 4).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditingTag({ ...editingTag, color })}
                        className={`w-5 h-5 rounded-full border transition-all ${
                          editingTag.color === color ? 'border-slate-900' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={handleUpdateTag}
                  >
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => setEditingTag(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                // 显示模式
                <>
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-sm">{tag.name}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => setEditingTag(tag)}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveTag(tag.id)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
          
          {tags.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              暂无标签，请添加新标签
            </div>
          )}
        </div>
      </div>

      {/* 说明 */}
      <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
        <p>这些标签将作为全局预设标签，在所有看板中可用。</p>
      </div>
    </div>
  )
}
