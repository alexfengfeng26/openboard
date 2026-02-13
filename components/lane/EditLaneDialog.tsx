'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2 } from 'lucide-react'
import type { Lane } from '@/lib/db'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface EditLaneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lane: Lane | null
  onLaneUpdated: (lane: Lane) => void
  onLaneDeleted: () => void
  boardId: string
}

export function EditLaneDialog({ open, onOpenChange, lane, onLaneUpdated, onLaneDeleted, boardId }: EditLaneDialogProps) {
  const [title, setTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (lane) {
      setTitle(lane.title)
    }
  }, [lane])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!lane || !title.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/lanes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          laneId: lane.id,
          title: title.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update lane')
      }

      onLaneUpdated({
        ...lane,
        title: title.trim(),
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating lane:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!lane) return

    try {
      const response = await fetch(`/api/lanes?id=${lane.id}&boardId=${boardId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete lane')
      }

      onLaneDeleted()
      onOpenChange(false)
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Error deleting lane:', error)
    }
  }

  function handleClose() {
    if (!isSubmitting) {
      onOpenChange(false)
    }
  }

  if (!lane) return null

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base">编辑列表</DialogTitle>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="edit-lane-title" className="text-xs font-medium text-slate-700">
                    列表标题
                  </label>
                  <Input
                    id="edit-lane-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入列表标题..."
                    disabled={isSubmitting}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                  <span className="font-medium text-slate-700">{lane.cards.length}</span>
                  <span>个卡片</span>
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting || lane.cards.length > 0}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                删除列表
              </Button>
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
                  取消
                </Button>
                <Button type="submit" size="sm" disabled={!title.trim() || isSubmitting}>
                  {isSubmitting ? '保存中...' : '保存'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="删除列表"
        description={lane.cards.length > 0
          ? `此列表包含 ${lane.cards.length} 个卡片，删除列表将同时删除所有卡片。确定要继续吗？`
          : '确定要删除这个列表吗？此操作无法撤销。'
        }
        confirmText="删除"
        onConfirm={handleDelete}
      />
    </>
  )
}
