'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '@/lib/db'
import { CardItem } from './CardItem'

interface DraggableCardProps {
  card: Card
  onEdit?: (card: Card) => void
  selected?: boolean
  selectionMode?: boolean
  onSelectToggle?: (cardId: string) => void
  onSelectRange?: (toCardId: string) => void
}

export const DraggableCard = memo(function DraggableCard({
  card,
  onEdit,
  selected,
  selectionMode,
  onSelectToggle,
  onSelectRange,
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'CARD',
      laneId: card.laneId,
    },
  })

  const style: React.CSSProperties = {}
  if (transform) {
    style.transform = CSS.Transform.toString(transform)
  }
  if (transition) {
    style.transition = transition
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardItem
        card={card}
        isDragging={isDragging}
        onEdit={onEdit}
        selected={selected}
        selectionMode={selectionMode}
        onSelectToggle={onSelectToggle}
        onSelectRange={onSelectRange}
      />
    </div>
  )
})
