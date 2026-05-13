'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TemplateCard } from './TemplateCard'
import { useTemplates, useTemplateActions } from '@/lib/hooks/useTemplates'
import type { Template, TemplateType, TemplateScope } from '@/types/template.types'
import { Search, X } from 'lucide-react'

const TYPE_LABELS: Record<TemplateType, string> = {
  board: '看板',
  card: '卡片',
  lane: '列表',
  automation: '自动化',
  prompt: '提示词',
}

interface TemplateSelectorProps {
  open: boolean
  type: TemplateType
  scope?: TemplateScope
  boardId?: string
  onSelect: (template: Template) => void
  onCancel: () => void
}

export function TemplateSelector({ open, type, scope, boardId, onSelect, onCancel }: TemplateSelectorProps) {
  const [search, setSearch] = useState('')
  const { templates, loading, fetchTemplates } = useTemplates({ type, scope, boardId })
  const { cloneTemplate } = useTemplateActions()

  const filtered = useMemo(() => {
    if (!search.trim()) return templates
    const q = search.toLowerCase()
    return templates.filter(
      (t) =>
        t.meta.name.toLowerCase().includes(q) ||
        t.meta.description?.toLowerCase().includes(q) ||
        t.meta.tags?.some((tag) => tag.toLowerCase().includes(q))
    )
  }, [templates, search])

  const handleClone = async (template: Template) => {
    try {
      const cloned = await cloneTemplate(template.meta.id, {
        name: `${template.meta.name} (自定义)`,
      })
      onSelect(cloned)
    } catch {
      // 克隆失败则直接使用原模板
      onSelect(template)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-base">选择{TYPE_LABELS[type]}模板</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模板..."
              className="h-9 pl-9 pr-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <div>{search ? '未找到匹配的模板' : '暂无模板'}</div>
              {!search && (
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => fetchTemplates()}>
                  重新加载模板库
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.meta.id}
                  template={template}
                  onSelect={onSelect}
                  onClone={template.meta.builtin ? handleClone : undefined}
                />
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
