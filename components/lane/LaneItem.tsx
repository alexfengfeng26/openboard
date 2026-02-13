'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Lane, Card } from '@/lib/db'
import { CardItem } from '@/components/card/CardItem'
import { DraggableCard } from '@/components/card/DraggableCard'
import { CreateCardDialog } from '@/components/card/CreateCardDialog'
import { EditLaneDialog } from '@/components/lane/EditLaneDialog'
import { Plus, Edit2, GripVertical, MoreHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

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
  const [showActions, setShowActions] = useState(false)

  const cardIds = lane.cards.map((card) => card.id)

  return (
    <div 
      className={cn(
        'flex h-full w-64 shrink-0 flex-col rounded-2xl transition-all duration-300',
        'bg-gradient-to-b from-slate-50/80 to-slate-100/50',
        'border border-slate-200/60',
        'shadow-sm backdrop-blur-sm',
        isHovered && 'ring-2 ring-indigo-500/30 ring-offset-2 bg-indigo-50/30'
      )}
    >
      {/* 列表头部 */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200/60">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-slate-200/60 text-slate-500 cursor-grab active:cursor-grabbing hover:bg-slate-300/60 transition-colors">
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          <h2
            className="text-sm font-bold text-slate-700 truncate cursor-pointer hover:text-indigo-600 transition-colors"
            onDoubleClick={() => setShowEditLane(true)}
            title={lane.title}
          >
            {lane.title}
          </h2>
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 px-1.5">
            {lane.cards.length}
          </span>
        </div>
        
        {/* 操作菜单 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowActions(!showActions)}
            className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all"
            title="更多操作"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          
          {showActions && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowActions(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-xl border border-slate-200/60 bg-white shadow-lg shadow-slate-500/10 py-1 animate-fade-in">
                <button
                  onClick={() => {
                    setShowEditLane(true)
                    setShowActions(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  编辑列表
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 卡片列表（拖放区域） */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2">
        <div 
          ref={setNodeRef} 
          className={cn(
            'min-h-[100px] rounded-xl p-1.5 transition-all duration-200',
            isHovered && 'bg-indigo-500/5'
          )}
        >
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {lane.cards.map((card) => (
                <DraggableCard key={card.id} card={card} onEdit={onCardEdit} />
              ))}

              {lane.cards.length === 0 && (
                <div className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-xs">拖放卡片到此处</span>
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>

      {/* 添加卡片按钮 */}
      <div className="p-2 border-t border-slate-200/60">
        <button
          onClick={() => setShowCreateCard(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 transition-all duration-200 hover:bg-white hover:text-indigo-600 hover:shadow-sm border border-transparent hover:border-slate-200/60"
        >
          <Plus className="h-4 w-4" />
          <span>添加卡片</span>
        </button>
      </div>

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

  const style: React.CSSProperties = {}
  if (transform) {
    style.transform = CSS.Transform.toString(transform)
  }
  if (transition) {
    style.transition = transition
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        'transition-opacity duration-200',
        isDragging && 'opacity-50'
      )}
    >
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
