'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TemplateSelector } from '@/components/template/TemplateSelector'
import type { CardTemplateContent, Template } from '@/types/template.types'
import { LayoutTemplate } from 'lucide-react'

interface CreateLaneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLaneCreated: (title: string, cards?: CardTemplateContent[]) => Promise<void> | void
}

export function CreateLaneDialog({ open, onOpenChange, onLaneCreated }: CreateLaneDialogProps) {
  const [title, setTitle] = useState('')
  const [templateCards, setTemplateCards] = useState<CardTemplateContent[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      await onLaneCreated(title.trim(), templateCards)
      setTitle('')
      setTemplateCards([])
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleClose() {
    if (!isSubmitting) {
      setTitle('')
      setTemplateCards([])
      onOpenChange(false)
    }
  }

  function handleSelectTemplate(template: Template) {
    const content = template.content as { title?: string; cards?: CardTemplateContent[] }
    if (content.title) setTitle(content.title)
    setTemplateCards(content.cards || [])
    setShowTemplateSelector(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base">创建列表</DialogTitle>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 text-xs"
                  onClick={() => setShowTemplateSelector(true)}
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  选择列表模板
                </Button>
                <div className="space-y-1.5">
                  <label htmlFor="lane-title" className="text-xs font-medium text-foreground">
                    列表标题 <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="lane-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：待办、进行中、已完成"
                    disabled={isSubmitting}
                    autoFocus
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={!title.trim() || isSubmitting}>
                {isSubmitting ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TemplateSelector
        open={showTemplateSelector}
        type="lane"
        onSelect={handleSelectTemplate}
        onCancel={() => setShowTemplateSelector(false)}
      />
    </>
  )
}
