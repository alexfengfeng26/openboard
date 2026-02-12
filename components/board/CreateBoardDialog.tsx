'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toastSuccess, toastError } from '@/components/ui/toast'
import type { Board } from '@/lib/db'

interface CreateBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBoardCreated: (board: Board) => void
}

export function CreateBoardDialog({ open, onOpenChange, onBoardCreated }: CreateBoardDialogProps) {
  const [title, setTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || isSubmitting) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })

      if (!response.ok) throw new Error('Failed to create board')

      const result = await response.json()
      if (result.success) {
        onBoardCreated(result.data)
        toastSuccess('看板创建成功')
        setTitle('')
        onOpenChange(false)
      }
    } catch (error) {
      toastError('创建看板失败')
    } finally {
      setIsSubmitting(false)
    }
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
            <DialogTitle className="text-base">创建看板</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <label htmlFor="board-title" className="text-xs font-medium">
                看板名称 <span className="text-destructive">*</span>
              </label>
              <Input
                id="board-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：项目开发、市场营销"
                disabled={isSubmitting}
                autoFocus
                className="h-8 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              新看板将包含 3 个默认列表：待办、进行中、已完成
            </p>
          </div>

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
