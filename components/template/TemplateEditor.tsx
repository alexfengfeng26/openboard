'use client'

import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TemplateVariablePicker } from './TemplateVariablePicker'
import { PromptTemplatePreview } from './PromptTemplatePreview'
import type { Template, TemplateDraft, TemplateType } from '@/types/template.types'
import { X, Plus } from 'lucide-react'

const TYPE_LABELS: Record<TemplateType, string> = {
  board: '看板',
  card: '卡片',
  lane: '列表',
  automation: '自动化',
  prompt: '提示词',
}

interface TemplateEditorProps {
  open: boolean
  template?: Template | null
  defaultType?: TemplateType
  onSave: (draft: TemplateDraft) => void
  onCancel: () => void
}

export function TemplateEditor({ open, template, defaultType = 'board', onSave, onCancel }: TemplateEditorProps) {
  const isEdit = !!template
  const isBuiltin = template?.meta.builtin ?? false
  const [name, setName] = useState(template?.meta.name ?? '')
  const [description, setDescription] = useState(template?.meta.description ?? '')
  const [tags, setTags] = useState<string[]>(template?.meta.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [type] = useState<TemplateType>(template?.meta.type ?? defaultType)

  // Content states
  const [promptText, setPromptText] = useState(
    type === 'prompt' && template?.content ? (template.content as { text: string }).text : ''
  )
  const [cardTitle, setCardTitle] = useState(
    type === 'card' && template?.content ? (template.content as { title: string }).title : ''
  )
  const [cardDesc, setCardDesc] = useState(
    type === 'card' && template?.content ? (template.content as { description?: string }).description ?? '' : ''
  )
  const [laneTitle, setLaneTitle] = useState(
    type === 'lane' && template?.content ? (template.content as { title: string }).title : ''
  )
  const [boardLanes, setBoardLanes] = useState<string[]>(
    type === 'board' && template?.content
      ? (template.content as { lanes: { title: string }[] }).lanes.map((l) => l.title)
      : ['待办', '进行中', '已完成']
  )

  const handleAddTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleAddLane = () => {
    setBoardLanes([...boardLanes, ''])
  }

  const handleUpdateLane = (index: number, value: string) => {
    const next = [...boardLanes]
    next[index] = value
    setBoardLanes(next)
  }

  const handleRemoveLane = (index: number) => {
    setBoardLanes(boardLanes.filter((_, i) => i !== index))
  }

  const buildContent = useCallback((): TemplateDraft['content'] => {
    switch (type) {
      case 'prompt':
        return { text: promptText, variables: [] }
      case 'card':
        return { title: cardTitle, description: cardDesc || undefined, tags }
      case 'lane':
        return { title: laneTitle, cards: [] }
      case 'board':
        return { lanes: boardLanes.filter(Boolean).map((title) => ({ title })) }
      case 'automation':
        return { trigger: { type: 'card_created', conditions: [] }, actions: [] }
      default:
        return { lanes: [] }
    }
  }, [type, promptText, cardTitle, cardDesc, laneTitle, boardLanes, tags])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const draft: TemplateDraft = {
      meta: {
        type,
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        scope: 'global',
        builtin: false,
      },
      content: buildContent(),
    }

    onSave(draft)
  }

  const insertVariable = (variable: string) => {
    setPromptText((prev) => prev + variable)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base">
              {isEdit ? (isBuiltin ? '查看模板' : '编辑模板') : `新建${TYPE_LABELS[type]}模板`}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {isBuiltin && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                内置模板不可编辑，您可以复制后创建自定义版本
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium">模板名称</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入模板名称"
                disabled={isBuiltin}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">描述</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述模板用途"
                disabled={isBuiltin}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">标签</label>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
                  >
                    {tag}
                    {!isBuiltin && (
                      <button type="button" onClick={() => handleRemoveTag(tag)}>
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                {!isBuiltin && (
                  <div className="flex items-center gap-1">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="添加标签"
                      className="h-7 w-24 text-xs"
                    />
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddTag}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Type-specific content editors */}
            {type === 'prompt' && (
              <div className="space-y-2">
                <label className="text-xs font-medium">提示词内容</label>
                {!isBuiltin && <TemplateVariablePicker onInsert={insertVariable} />}
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="输入提示词文本，可使用 {{variable}} 插入变量"
                  disabled={isBuiltin}
                  className="min-h-[120px] w-full rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-sm focus:border-ring/45 focus:outline-none focus:ring-2 focus:ring-ring/12 disabled:bg-muted"
                />
                <PromptTemplatePreview text={promptText} />
              </div>
            )}

            {type === 'card' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">默认标题</label>
                  <Input
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="卡片默认标题"
                    disabled={isBuiltin}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">默认描述</label>
                  <textarea
                    value={cardDesc}
                    onChange={(e) => setCardDesc(e.target.value)}
                    placeholder="卡片默认描述（支持 Markdown）"
                    disabled={isBuiltin}
                    className="min-h-[100px] w-full rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-sm focus:border-ring/45 focus:outline-none focus:ring-2 focus:ring-ring/12 disabled:bg-muted"
                  />
                </div>
              </>
            )}

            {type === 'lane' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">默认列表标题</label>
                <Input
                  value={laneTitle}
                  onChange={(e) => setLaneTitle(e.target.value)}
                  placeholder="列表默认标题"
                  disabled={isBuiltin}
                />
              </div>
            )}

            {type === 'board' && (
              <div className="space-y-2">
                <label className="text-xs font-medium">预置列表</label>
                <div className="space-y-1.5">
                  {boardLanes.map((lane, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={lane}
                        onChange={(e) => handleUpdateLane(index, e.target.value)}
                        placeholder={`列表 ${index + 1}`}
                        disabled={isBuiltin}
                      />
                      {!isBuiltin && boardLanes.length > 1 && (
                        <Button type="button" size="sm" variant="ghost" className="h-9 px-2" onClick={() => handleRemoveLane(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {!isBuiltin && (
                  <Button type="button" size="sm" variant="outline" className="w-full" onClick={handleAddLane}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    添加列表
                  </Button>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              取消
            </Button>
            {!isBuiltin && (
              <Button type="submit" size="sm" disabled={!name.trim()}>
                {isEdit ? '保存' : '创建'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
