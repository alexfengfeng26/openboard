'use client'

import { CardFormDialog } from './CardFormDialog'
import type { Card } from '@/lib/db'

interface EditCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: Card | null
  onCardUpdated: (card: Card) => void
  onCardDeleted: () => void
  boardId: string
}

export function EditCardDialog({
  open,
  onOpenChange,
  card,
  onCardUpdated,
  onCardDeleted,
  boardId,
}: EditCardDialogProps) {
  return (
    <CardFormDialog
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
      card={card}
      boardId={boardId}
      onCardUpdated={onCardUpdated}
      onCardDeleted={onCardDeleted}
    />
  )
}
