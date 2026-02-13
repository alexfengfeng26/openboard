'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Lane, Card } from '@/lib/db'
import { CardItem } from '@/components/card/CardItem'
import { DraggableCard } from '@/components/card/DraggableCard'
import { CreateCardDialog } from '@/components/card/CreateCardDialog'
import { EditLaneDialog } from '@/components/lane/EditLaneDialog'
import { Button } from '@/components/ui/button'
import { Plus, Edit2, GripVertical } from 'lucide-react'
import { useState } from 'react'

interface LaneItemProps {
  lane: Lane
  onLaneUpdate: (lane: Lane) => void
  onCardEdit?: (card: Card) => void
  isHovered?: boolean
  onLaneDeleted?: (laneId: string) => void
  boardId: string
}

function LaneContent({ lane, onLaneUpdate, onCardEdit, isHovered, onLaneDeleted, boardId }: LaneItemProps) {
  const { setNodeRef } = useDroppable({
    id: lane.id,
    data: {
      type: 'LANE',
      accepts: ['CARD'],
    },
  })

  const [showCreateCard, setShowCreateCard] = useState(false)
  const [showEditLane, setShowEditLane] = useState(false)

  const cardIds = lane.cards.map((card) => card.id)

  return (
    <div className={`flex h-full w-64 shrink-0 flex-col rounded-lg bg-muted/50 py-3 px-2 ${isHovered ? 'ring-2 ring-primary/50 bg-muted' : ''}`}>
      {/* 列表头部 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <h2
            className="font-semibold cursor-pointer hover:text-primary"
            onDoubleClick={() => setShowEditLane(true)}
          >
            {lane.title}
          </h2>
          <span className="text-xs text-muted-foreground">{lane.cards.length}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowEditLane(true)}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      </div>

      {/* 卡片列表（拖放区域） */}
      <div className="flex-1 overflow-y-auto">
        <div ref={setNodeRef} className={`min-h-[100px] space-y-2 ${isHovered ? 'bg-primary/5 rounded-md p-2 -m-2' : ''}`}>
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {lane.cards.map((card) => (
              <DraggableCard key={card.id} card={card} onEdit={onCardEdit} />
            ))}

            {lane.cards.length === 0 && (
              <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-muted-foreground/20 text-xs text-muted-foreground">
                暂无卡片
              </div>
            )}
          </SortableContext>
        </div>
      </div>

      {/* 添加卡片按钮 */}
      <Button
        variant="ghost"
        className="mt-2 justify-start"
        onClick={() => setShowCreateCard(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        添加卡片
      </Button>

      {/* 创建卡片对话框 */}
      <CreateCardDialog
        open={showCreateCard}
        onOpenChange={setShowCreateCard}
        laneId={lane.id}
        boardId={boardId}
        onCardCreated={(card) => {
          onLaneUpdate({
            ...lane,
            cards: [...lane.cards, card],
          })
        }}
      />

      {/* 编辑列表对话框 */}
      <EditLaneDialog
        open={showEditLane}
        onOpenChange={setShowEditLane}
        lane={lane}
        boardId={boardId}
        onLaneUpdated={onLaneUpdate}
        onLaneDeleted={() => {
          onLaneDeleted?.(lane.id)
        }}
      />
    </div>
  )
}

export function LaneItem({ lane, onLaneUpdate, onCardEdit, isHovered, onLaneDeleted, boardId }: LaneItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lane.id,
    data: {
      type: 'LANE',
    },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (isDragging) {
    style.opacity = 0.5
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LaneContent
        lane={lane}
        onLaneUpdate={onLaneUpdate}
        onCardEdit={onCardEdit}
        isHovered={isHovered}
        onLaneDeleted={onLaneDeleted}
        boardId={boardId}
      />
    </div>
  )
}
