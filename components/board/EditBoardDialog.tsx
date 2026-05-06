'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Archive, RotateCcw } from 'lucide-react'
import { toastSuccess, toastError } from '@/components/ui/toast'
import type { Board } from '@/lib/db'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface EditBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  board: Board
  onBoardUpdated: (board: Board) => void
  onBoardDeleted: (boardId: string) => void
  onBoardArchived?: (board: Board) => void
}

export function EditBoardDialog({
  open,
  onOpenChange,
  board,
  onBoardUpdated,
  onBoardDeleted,
  onBoardArchived,
}: EditBoardDialogProps) {
  const [title, setTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  useEffect(() => {
    if (board) setTitle(board.title)
  }, [board])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!board || !title.trim()) return

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })

      if (!response.ok) throw new Error('Failed to update board')

      const result = await response.json()
      if (result.success) {
        onBoardUpdated(result.data)
        toastSuccess('看板更新成功')
        onOpenChange(false)
      }
    } catch (error) {
      toastError('更新看板失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!board) return

    try {
      const response = await fetch(`/api/boards/${board.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        if (error.error?.includes('last board')) {
          toastError('无法删除最后一个看板')
          return
        }
        throw new Error('Failed to delete board')
      }

      onBoardDeleted(board.id)
      toastSuccess('看板已删除')
      onOpenChange(false)
      setShowDeleteConfirm(false)
    } catch (error) {
      toastError('删除看板失败')
    }
  }

  async function handleArchive() {
    if (!board) return

    const archived = !board.archivedAt
    try {
      const response = await fetch(`/api/boards/${board.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      })

      if (!response.ok) throw new Error('Failed to archive board')

      const result = await response.json()
      if (result.success) {
        onBoardUpdated?.(result.data)
        onBoardArchived?.(result.data)
        toastSuccess(archived ? '看板已归档' : '看板已恢复')
        onOpenChange(false)
        setShowArchiveConfirm(false)
      }
    } catch (error) {
      toastError(archived ? '归档看板失败' : '恢复看板失败')
    }
  }

  function handleClose() {
    if (!isSubmitting) onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base">编辑看板</DialogTitle>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="edit-board-title" className="text-xs font-medium text-slate-700">
                    看板名称
                  </label>
                  <Input
                    id="edit-board-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入看板名称..."
                    disabled={isSubmitting}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                删除
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowArchiveConfirm(true)}
                disabled={isSubmitting}
              >
                {board?.archivedAt ? (
                  <>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    恢复
                  </>
                ) : (
                  <>
                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                    归档
                  </>
                )}
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
        title="删除看板"
        description="确定要删除这个看板吗？看板下的所有列表和卡片也将被删除，此操作无法撤销。"
        confirmText="删除"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={showArchiveConfirm}
        onOpenChange={setShowArchiveConfirm}
        title={board?.archivedAt ? '恢复看板' : '归档看板'}
        description={
          board?.archivedAt
            ? '确定要恢复这个看板吗？恢复后看板将重新显示在看板列表中。'
            : '确定要归档这个看板吗？归档后看板将隐藏，但可以通过“显示已归档”查看。'
        }
        confirmText={board?.archivedAt ? '恢复' : '归档'}
        onConfirm={handleArchive}
      />
    </>
  )
}
