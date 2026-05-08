'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toastSuccess, toastError } from '@/components/ui/toast'
import type { Board } from '@/lib/db'
import { BOARD_TEMPLATES, getTemplateById } from '@/lib/templates/board-templates'
import { Layout, Rocket, FileText, Bug, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBoardCreated: (board: Board) => void
}

type Step = 'template' | 'title'

const ICON_MAP: Record<string, React.ReactNode> = {
  Layout: <Layout className="h-6 w-6" />,
  Rocket: <Rocket className="h-6 w-6" />,
  FileText: <FileText className="h-6 w-6" />,
  Bug: <Bug className="h-6 w-6" />,
}

export function CreateBoardDialog({ open, onOpenChange, onBoardCreated }: CreateBoardDialogProps) {
  const [step, setStep] = useState<Step>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('basic')
  const [title, setTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || isSubmitting) return

    const template = getTemplateById(selectedTemplateId)
    const lanes = template?.lanes.map((l) => ({ title: l.title }))

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          lanes,
        }),
      })

      if (!response.ok) throw new Error('Failed to create board')

      const result = await response.json()
      if (result.success) {
        onBoardCreated(result.data)
        toastSuccess('看板创建成功')
        handleReset()
        onOpenChange(false)
      }
    } catch (error) {
      toastError('创建看板失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleReset() {
    setStep('template')
    setSelectedTemplateId('basic')
    setTitle('')
  }

  function handleClose() {
    if (!isSubmitting) {
      handleReset()
      onOpenChange(false)
    }
  }

  function handleNext() {
    setStep('title')
  }

  function handleBack() {
    setStep('template')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'template' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">选择看板模板</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-2 gap-3">
                {BOARD_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={cn(
                      'relative flex flex-col items-start gap-2 rounded-md border p-4 text-left transition-colors',
                      selectedTemplateId === template.id
                        ? 'border-ring/40 bg-muted ring-1 ring-ring/20'
                        : 'border-border hover:border-ring/30 hover:bg-muted/50'
                    )}
                  >
                    {selectedTemplateId === template.id && (
                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                    <div className="text-muted-foreground">{ICON_MAP[template.icon] || <Layout className="h-6 w-6" />}</div>
                    <div>
                      <div className="text-sm font-medium">{template.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                        {template.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
                取消
              </Button>
              <Button type="button" size="sm" onClick={handleNext}>
                下一步
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base">创建看板</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="board-title" className="text-xs font-medium text-foreground">
                    看板名称 <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="board-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：项目开发、市场营销"
                    disabled={isSubmitting}
                    autoFocus
                    className="h-9 text-sm"
                  />
                </div>
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  已选择模板：{getTemplateById(selectedTemplateId)?.name}，
                  包含 {getTemplateById(selectedTemplateId)?.lanes.length} 个列表
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={handleBack} disabled={isSubmitting}>
                返回
              </Button>
              <Button type="submit" size="sm" disabled={!title.trim() || isSubmitting}>
                {isSubmitting ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
