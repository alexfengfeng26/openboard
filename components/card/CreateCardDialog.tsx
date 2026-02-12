'use client'

import { CardFormDialog } from './CardFormDialog'
import type { Card } from '@/lib/db'

interface CreateCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  laneId: string
  boardId: string
  onCardCreated: (card: Card) => void
}

export function CreateCardDialog({ open, onOpenChange, laneId, boardId, onCardCreated }: CreateCardDialogProps) {
  return (
    <CardFormDialog
      open={open}
      onOpenChange={onOpenChange}
      mode="create"
      laneId={laneId}
      boardId={boardId}
      onCardCreated={onCardCreated}
    />
  )
}
