'use client'

import { useMemo } from 'react'
import { resolveVariables } from '@/lib/template/variable-resolver'
import type { TemplateVariableContext } from '@/types/template.types'

interface PromptTemplatePreviewProps {
  text: string
}

const mockContext: TemplateVariableContext = {
  board: { id: 'board-demo', title: '示例看板' },
  lane: { id: 'lane-demo', title: '进行中' },
  card: { id: 'card-demo', title: '示例卡片' },
  user: { name: '张三', id: 'user-demo' },
}

export function PromptTemplatePreview({ text }: PromptTemplatePreviewProps) {
  const preview = useMemo(() => {
    if (!text) return ''
    return resolveVariables(text, mockContext)
  }, [text])

  const hasVariables = useMemo(() => /\{\{[\w.]+(\|[^}]*)?\}\}/.test(text), [text])

  if (!text) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        输入提示词文本后将在此显示预览
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">预览</div>
      <div className="whitespace-pre-wrap text-sm text-foreground">
        {hasVariables ? (
          <>
            {preview}
          </>
        ) : (
          <span className="text-muted-foreground">{preview}</span>
        )}
      </div>
    </div>
  )
}
