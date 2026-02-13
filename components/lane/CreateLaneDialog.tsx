'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CreateLaneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLaneCreated: (title: string) => void
}

export function CreateLaneDialog({ open, onOpenChange, onLaneCreated }: CreateLaneDialogProps) {
  const [title, setTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      return
    }

    setIsSubmitting(true)

    // 调用父组件传入的创建函数
    await onLaneCreated(title.trim())

    setIsSubmitting(false)
    setTitle('')
  }

  function handleClose() {
    if (!isSubmitting) {
      setTitle('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base">创建列表</DialogTitle>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="lane-title" className="text-xs font-medium text-slate-700">
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
  )
}
