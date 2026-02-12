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
    <div className={`flex h-full w-56 shrink-0 flex-col rounded-lg bg-muted/40 p-2 transition-all ${isHovered ? 'ring-1.5 ring-primary/60 ring-offset-1 bg-muted/60' : ''}`}>
      {/* 列表头部 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
          <h2
            className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
            onDoubleClick={() => setShowEditLane(true)}
          >
            {lane.title}
          </h2>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/10 text-[10px] font-medium text-muted-foreground">
            {lane.cards.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setShowEditLane(true)}
            className="h-6 w-6 rounded p-0.5 hover:bg-muted text-muted-foreground"
            title="编辑列表"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 卡片列表（拖放区域） */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div ref={setNodeRef} className={`min-h-[128px] p-0.5 -m-0.5 rounded-md transition-colors ${isHovered ? 'bg-primary/8' : ''}`}>
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {lane.cards.map((card) => (
                <DraggableCard key={card.id} card={card} onEdit={onCardEdit} />
              ))}

              {lane.cards.length === 0 && (
                <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-muted-foreground/15 text-xs text-muted-foreground">
                  暂无卡片
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>

      {/* 添加卡片按钮 */}
      <button
        onClick={() => setShowCreateCard(true)}
        className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted-foreground/8"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>添加卡片</span>
      </button>

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
          // 通知父组件列表已删除
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

  const style: React.CSSProperties = {}
  if (transform) {
    style.transform = CSS.Transform.toString(transform)
  }
  if (transition) {
    style.transition = transition
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
