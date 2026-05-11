'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toastError, toastSuccess } from '@/components/ui/toast'
import { useBoardTags } from '@/components/board/BoardTagsContext'
import type { Tag } from '@/lib/db'

interface TagSelectorProps {
  selectedTags: Tag[]
  onTagsChange: (tags: Tag[]) => void
  disabled?: boolean
  availableTags?: Tag[]
  enableAiTagging?: boolean
  aiTitle?: string
  aiDescription?: string
}

export function TagSelector({
  selectedTags,
  onTagsChange,
  disabled,
  availableTags: propTags,
  enableAiTagging = false,
  aiTitle,
  aiDescription,
}: TagSelectorProps) {
  const contextTags = useBoardTags()
  const [availableTags, setAvailableTags] = useState<Tag[]>(propTags || contextTags || [])
  const [showAll, setShowAll] = useState(false)
  const [aiTagging, setAiTagging] = useState(false)

  useEffect(() => {
    if (propTags && propTags.length > 0) {
      setAvailableTags(propTags)
      return
    }

    if (contextTags && contextTags.length > 0) {
      setAvailableTags(contextTags)
      return
    }

    async function fetchTags() {
      try {
        const response = await fetch('/api/tags')
        const result = await response.json()
        if (result.success) {
          setAvailableTags(result.data)
        }
      } catch (error) {
        toastError('获取标签失败')
      }
    }
    fetchTags()
  }, [propTags, contextTags])

  const isTagSelected = (tag: Tag) => selectedTags.some((t) => t.id === tag.id)

  function toggleTag(tag: Tag) {
    if (isTagSelected(tag)) {
      onTagsChange(selectedTags.filter((t) => t.id !== tag.id))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  async function handleAiTagging() {
    if (disabled || aiTagging) return
    const title = (aiTitle || '').trim()
    const description = (aiDescription || '').trim()
    if (!title && !description) {
      toastError('请先填写卡片标题或描述，再使用 AI 标签')
      return
    }
    if (!Array.isArray(availableTags) || availableTags.length === 0) {
      toastError('当前没有可用标签')
      return
    }

    setAiTagging(true)
    try {
      const response = await fetch('/api/ai/tag-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          availableTags,
          maxTags: 3,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'AI 标签识别失败')
      }

      const suggestions = (Array.isArray(result?.data) ? result.data : []) as Tag[]
      if (suggestions.length === 0) {
        toastError('未识别到合适标签')
        return
      }

      const allowed = new Map(availableTags.map((tag) => [tag.id, tag] as const))
      const selected = new Set(selectedTags.map((tag) => tag.id))
      const merged = [...selectedTags]
      let added = 0
      for (const suggestion of suggestions) {
        const safeTag = allowed.get(suggestion.id)
        if (!safeTag || selected.has(safeTag.id)) continue
        merged.push(safeTag)
        selected.add(safeTag.id)
        added++
        if (merged.length >= 10) break
      }

      if (added === 0) {
        toastError('AI 推荐标签已存在或无可用新增标签')
        return
      }

      onTagsChange(merged)
      toastSuccess(`AI 已添加 ${added} 个标签`)
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'AI 标签识别失败')
    } finally {
      setAiTagging(false)
    }
  }

  return (
    <div className="space-y-1.5">
      {/* 已选择的标签 */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-0.5 pr-1 h-5 px-1.5 py-0.5 text-[10px]"
              style={{
                backgroundColor: tag.color + '20',
                color: tag.color,
                border: `1px solid ${tag.color}40`,
              }}
            >
              {tag.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="ml-0.5 hover:opacity-70"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* 所有标签选择器 */}
      {showAll ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {availableTags.map((tag) => (
              <Badge
                key={tag.id}
                variant={isTagSelected(tag) ? 'default' : 'outline'}
                className="cursor-pointer gap-0.5 pr-1 h-5 px-1.5 py-0.5 text-[10px]"
                style={isTagSelected(tag) ? {
                  backgroundColor: tag.color,
                  color: '#ffffff',
                } : {
                  borderColor: tag.color + '60',
                  color: tag.color,
                }}
                onClick={() => !disabled && toggleTag(tag)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAll(false)}
            className="w-full"
          >
            收起
          </Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAll(true)}
            disabled={disabled}
            className="flex-1"
          >
            <Plus className="mr-1 h-3 w-3" />
            添加标签
          </Button>
          {enableAiTagging && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleAiTagging()}
              disabled={disabled || aiTagging}
              className="px-2.5"
              title="根据卡片内容自动匹配现有标签"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              {aiTagging ? '识别中...' : 'AI标签'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
