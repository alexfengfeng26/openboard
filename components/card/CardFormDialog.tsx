'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Paperclip, X } from 'lucide-react'
import { TagSelector } from '@/components/card/TagSelector'
import { toastSuccess, toastError } from '@/components/ui/toast'
import type { Card, Tag, Attachment } from '@/lib/db'
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
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && card) {
      setTitle(card.title)
      setDescription(card.description || '')
      setTags(card.tags || [])
      setAttachments(card.attachments || [])
    } else {
      setTitle('')
      setDescription('')
      setTags([])
      setAttachments([])
    }
  }, [mode, card, open])

  async function uploadFile(file: File): Promise<Attachment | null> {
    try {
      const cardId = mode === 'edit' && card ? card.id : 'temp'
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/cards/${cardId}/attachments?boardId=${boardId}`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (result.success) {
        return result.data as Attachment
      }
      toastError(result.error || '上传失败')
      return null
    } catch {
      toastError('上传附件失败')
      return null
    }
  }

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      const attachment = await uploadFile(file)
      if (attachment) {
        setAttachments((prev) => [...prev, attachment])
      }
    }
  }, [boardId, mode, card])

  async function handleRemoveAttachment(attachmentId: string) {
    try {
      const cardId = mode === 'edit' && card ? card.id : 'temp'
      await fetch(`/api/cards/${cardId}/attachments/${attachmentId}?boardId=${boardId}`, {
        method: 'DELETE',
      })
    } catch {
      // silent fail
    }
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }

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
            attachments,
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
            attachments,
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
            attachments,
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
                  <label htmlFor={inputId} className="text-xs font-medium text-foreground">
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
                  <label htmlFor={descriptionId} className="text-xs font-medium text-foreground">
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
                  <label className="text-xs font-medium text-foreground">标签</label>
                  <TagSelector selectedTags={tags} onTagsChange={setTags} disabled={isSubmitting} />
                </div>

                {/* 附件区域 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">附件</label>
                  <div
                    className={[
                      'rounded-md border border-dashed p-4 transition-colors',
                      isDraggingOver
                        ? 'border-ring/30 bg-muted'
                        : 'border-border bg-muted/40 hover:border-ring/30',
                    ].join(' ')}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDraggingOver(true)
                    }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDraggingOver(false)
                      void handleFileSelect(e.dataTransfer.files)
                    }}
                  >
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <UploadIcon />
                      <p className="text-xs">拖拽文件到此处，或</p>
                      <label className="cursor-pointer">
                        <span className="text-xs font-medium text-primary hover:underline">点击上传</span>
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={(e) => void handleFileSelect(e.target.files)}
                          disabled={isSubmitting}
                        />
                      </label>
                      <p className="text-[10px] text-muted-foreground">单个文件最大 5MB</p>
                    </div>
                  </div>

                  {/* 附件列表 */}
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm"
                        >
                          {att.mimeType.startsWith('image/') ? (
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border">
                              <img
                                src={att.url}
                                alt={att.originalName}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{att.originalName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {(att.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRemoveAttachment(att.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            disabled={isSubmitting}
                            aria-label={`删除附件 ${att.originalName}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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

function UploadIcon() {
  return (
    <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}
