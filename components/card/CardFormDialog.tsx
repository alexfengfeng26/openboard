'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Trash2 } from 'lucide-react'
import { TagSelector } from '@/components/card/TagSelector'
import { toastSuccess, toastError } from '@/components/ui/toast'
import type { Card, Tag } from '@/lib/db'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export type CardFormMode = 'create' | 'edit'

interface CardFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CardFormMode
  card?: Card | null
  laneId?: string
  boardId: string
  onCardCreated?: (card: Card) => void
  onCardUpdated?: (card: Card) => void
  onCardDeleted?: () => void
}

export function CardFormDialog({
  open,
  onOpenChange,
  mode,
  card,
  laneId,
  boardId,
  onCardCreated,
  onCardUpdated,
  onCardDeleted,
}: CardFormDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && card) {
      setTitle(card.title)
      setDescription(card.description || '')
      setTags(card.tags || [])
    } else {
      setTitle('')
      setDescription('')
      setTags([])
    }
  }, [mode, card, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'create') {
        // Create mode
        const response = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boardId,
            laneId,
            title: title.trim(),
            description: description.trim() || undefined,
            tags,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create card')
        }

        const result = await response.json()

        if (result.success) {
          onCardCreated?.(result.data)
          toastSuccess('卡片创建成功')
          handleClose()
        }
      } else {
        // Edit mode
        if (!card) return

        const response = await fetch(`/api/cards?id=${card.id}&boardId=${boardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId: card.id,
            title: title.trim(),
            description: description.trim() || undefined,
            tags,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to update card')
        }

        const result = await response.json()

        if (result.success) {
          onCardUpdated?.({
            ...card,
            title: title.trim(),
            description: description.trim() || undefined,
            tags,
          })
          toastSuccess('卡片更新成功')
          onOpenChange(false)
        }
      }
    } catch (error) {
      if (mode === 'create') {
        toastError('创建卡片失败')
      } else {
        toastError('更新卡片失败')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (mode !== 'edit' || !card) return

    try {
      const response = await fetch(`/api/cards?id=${card.id}&boardId=${boardId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete card')
      }

      onCardDeleted?.()
      toastSuccess('卡片已删除')
      onOpenChange(false)
      setShowDeleteConfirm(false)
    } catch (error) {
      toastError('删除卡片失败')
    }
  }

  function handleClose() {
    if (!isSubmitting) {
      onOpenChange(false)
    }
  }

  const isEditMode = mode === 'edit'
  const dialogTitle = isEditMode ? '编辑卡片' : '创建卡片'
  const submitButtonText = isSubmitting ? (isEditMode ? '保存中...' : '创建中...') : (isEditMode ? '保存' : '创建')
  const inputId = isEditMode ? 'edit-card-title' : 'card-title'
  const descriptionId = isEditMode ? 'edit-card-description' : 'card-description'
  const dialogSizeClass = isEditMode ? undefined : 'sm:max-w-sm'
  const descriptionRows = isEditMode ? 10 : 6

  if (isEditMode && !card) return null

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={dialogSizeClass}>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base">{dialogTitle}</DialogTitle>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor={inputId} className="text-xs font-medium text-slate-700">
                    标题 <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id={inputId}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入卡片标题..."
                    disabled={isSubmitting}
                    autoFocus
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={descriptionId} className="text-xs font-medium text-slate-700">
                    描述
                  </label>
                  <Textarea
                    id={descriptionId}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="输入卡片描述..."
                    rows={descriptionRows}
                    disabled={isSubmitting}
                    className="text-sm resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">标签</label>
                  <TagSelector selectedTags={tags} onTagsChange={setTags} disabled={isSubmitting} />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className={isEditMode ? 'gap-2' : undefined}>
              {isEditMode && (
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
              )}
              <div className={isEditMode ? 'flex gap-2 ml-auto' : 'flex gap-2 w-full'}>
                <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
                  取消
                </Button>
                <Button type="submit" size="sm" disabled={!title.trim() || isSubmitting}>
                  {submitButtonText}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isEditMode && (
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="删除卡片"
          description="确定要删除这个卡片吗？此操作无法撤销。"
          confirmText="删除"
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
