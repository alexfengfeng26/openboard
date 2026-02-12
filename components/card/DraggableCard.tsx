'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '@/lib/db'
import { CardItem } from './CardItem'

interface DraggableCardProps {
  card: Card
  onEdit?: (card: Card) => void
}

export function DraggableCard({ card, onEdit }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'CARD',
      laneId: card.laneId,
    },
  })

  // 只有在存在 transform 或 transition 时才设置 style
  const style: React.CSSProperties = {}
  if (transform) {
    style.transform = CSS.Transform.toString(transform)
  }
  if (transition) {
    style.transition = transition
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardItem card={card} isDragging={isDragging} onEdit={onEdit} />
    </div>
  )
}
