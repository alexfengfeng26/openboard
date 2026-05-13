'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TemplateEditor } from './TemplateEditor'
import { useTemplateActions } from '@/lib/hooks/useTemplates'
import type { TemplateDraft, TemplateType } from '@/types/template.types'
import { toastSuccess, toastError } from '@/components/ui/toast'
import { Save, ChevronDown } from 'lucide-react'

interface CreateFromTemplateButtonProps {
  defaultType?: TemplateType
  sourceData?: {
    board?: { title: string; lanes?: { title: string }[] }
    card?: { title: string; description?: string }
    lane?: { title: string }
  }
  onCreated?: () => void
}

export function CreateFromTemplateButton({ defaultType = 'board', sourceData, onCreated }: CreateFromTemplateButtonProps) {
  const [showEditor, setShowEditor] = useState(false)
  const [editorType, setEditorType] = useState<TemplateType>(defaultType)
  const { createTemplate } = useTemplateActions()

  const handleOpen = (type: TemplateType) => {
    setEditorType(type)
    setShowEditor(true)
  }

  const buildDraft = (): TemplateDraft => {
    const base: TemplateDraft = {
      meta: {
        type: editorType,
        name: '',
        scope: 'global',
        builtin: false,
      },
      content: { lanes: [] } as TemplateDraft['content'],
    }

    if (editorType === 'board' && sourceData?.board) {
      base.meta.name = `${sourceData.board.title} 模板`
      base.content = {
        lanes: sourceData.board.lanes?.map((l) => ({ title: l.title })) || [],
      }
    } else if (editorType === 'card' && sourceData?.card) {
      base.meta.name = `${sourceData.card.title} 模板`
      base.content = {
        title: sourceData.card.title,
        description: sourceData.card.description,
      }
    } else if (editorType === 'lane' && sourceData?.lane) {
      base.meta.name = `${sourceData.lane.title} 模板`
      base.content = {
        title: sourceData.lane.title,
      }
    }

    return base
  }

  const handleSave = async (draft: TemplateDraft) => {
    try {
      await createTemplate(draft)
      toastSuccess('模板保存成功')
      setShowEditor(false)
      onCreated?.()
    } catch {
      toastError('保存模板失败')
    }
  }

  return (
    <>
      <div className="group relative inline-flex">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-xs"
          onClick={() => handleOpen(defaultType)}
        >
          <Save className="h-3.5 w-3.5" />
          保存为模板
          <ChevronDown className="h-3 w-3" />
        </Button>
        <div className="absolute right-0 top-full z-50 hidden min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-lg group-hover:block">
          <button
            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-xs text-popover-foreground hover:bg-muted"
            onClick={() => handleOpen('board')}
          >
            保存为看板模板
          </button>
          <button
            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-xs text-popover-foreground hover:bg-muted"
            onClick={() => handleOpen('card')}
          >
            保存为卡片模板
          </button>
          <button
            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-xs text-popover-foreground hover:bg-muted"
            onClick={() => handleOpen('lane')}
          >
            保存为列表模板
          </button>
        </div>
      </div>

      <TemplateEditor
        key={editorType}
        open={showEditor}
        defaultType={editorType}
        onSave={handleSave}
        onCancel={() => setShowEditor(false)}
      />
    </>
  )
}
