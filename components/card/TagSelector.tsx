'use client'

import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toastError } from '@/components/ui/toast'
import type { Tag } from '@/lib/db'

interface TagSelectorProps {
  selectedTags: Tag[]
  onTagsChange: (tags: Tag[]) => void
  disabled?: boolean
}

export function TagSelector({ selectedTags, onTagsChange, disabled }: TagSelectorProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
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
  }, [])

  const isTagSelected = (tag: Tag) => selectedTags.some((t) => t.id === tag.id)

  function toggleTag(tag: Tag) {
    if (isTagSelected(tag)) {
      onTagsChange(selectedTags.filter((t) => t.id !== tag.id))
    } else {
      onTagsChange([...selectedTags, tag])
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAll(true)}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="mr-1 h-3 w-3" />
          添加标签
        </Button>
      )}
    </div>
  )
}
