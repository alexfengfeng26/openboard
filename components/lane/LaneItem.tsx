'use client'

import { cn } from '@/lib/utils'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Lane, Card } from '@/lib/db'
import { DraggableCard } from '@/components/card/DraggableCard'
import { CreateCardDialog } from '@/components/card/CreateCardDialog'
import { EditLaneDialog } from '@/components/lane/EditLaneDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Edit2, GripVertical, Sparkles, Wand2, MoreHorizontal } from 'lucide-react'
import { useState, memo, useRef, useEffect } from 'react'

interface LaneItemProps {
  lane: Lane
  onLaneUpdate: (lane: Lane) => void
  onCardEdit?: (card: Card) => void
  isHovered?: boolean
  onLaneDeleted?: (laneId: string) => void
  boardId: string
  selectionMode?: boolean
  selectedCardIds?: Set<string>
  onCardSelectToggle?: (cardId: string) => void
  onCardSelectRange?: (toCardId: string) => void
  onOpenAI?: (laneId: string, laneTitle: string) => void
}

const LaneContent = memo(function LaneContent({
  lane,
  onLaneUpdate,
  onCardEdit,
  isHovered,
  onLaneDeleted,
  boardId,
  selectionMode,
  selectedCardIds,
  onCardSelectToggle,
  onCardSelectRange,
  onOpenAI,
}: LaneItemProps) {
  const { setNodeRef } = useDroppable({
    id: lane.id,
    data: {
      type: 'LANE',
      accepts: ['CARD'],
    },
  })

  const [showCreateCard, setShowCreateCard] = useState(false)
  const [showEditLane, setShowEditLane] = useState(false)
  const [isQuickAdding, setIsQuickAdding] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const quickInputRef = useRef<HTMLInputElement>(null)

  // AI 内联输入
  const [isAIInputOpen, setIsAIInputOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [isAIGenerating, setIsAIGenerating] = useState(false)
  const aiInputRef = useRef<HTMLInputElement>(null)
  const [showLaneActionsMenu, setShowLaneActionsMenu] = useState(false)

  useEffect(() => {
    function handleWindowClick() {
      setShowLaneActionsMenu(false)
    }
    if (showLaneActionsMenu) {
      window.addEventListener('click', handleWindowClick)
    }
    return () => window.removeEventListener('click', handleWindowClick)
  }, [showLaneActionsMenu])

  async function handleAIGenerate() {
    if (!aiQuery.trim() || isAIGenerating) return
    setIsAIGenerating(true)
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          system: `你是一个看板助手。用户希望在列表"${lane.title}"中创建卡片。请根据用户描述，返回一个 JSON 数组，每个元素包含 title 和 description。只返回 JSON，不要其他文字。格式：\n[{\"title\":\"...\",\"description\":\"...\"}]`,
          messages: [{ role: 'user', content: aiQuery.trim() }],
        }),
      })
      const data = await response.json().catch(() => null)
      let cards: Array<{ title: string; description?: string }> = []
      if (data?.content) {
        try {
          const parsed = JSON.parse(data.content)
          if (Array.isArray(parsed)) cards = parsed
        } catch {
          // fallback: 按行拆分
          const lines = data.content.split('\n').filter((l: string) => l.trim())
          cards = lines.map((l: string) => ({ title: l.trim() }))
        }
      }
      for (const card of cards) {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardId, laneId: lane.id, title: card.title, description: card.description }),
        })
        if (res.ok) {
          const result = await res.json()
          if (result.success) {
            onLaneUpdate({ ...lane, cards: [...lane.cards, result.data] })
          }
        }
      }
      setAiQuery('')
      setIsAIInputOpen(false)
    } catch {
      // 静默失败或显示简单错误
    } finally {
      setIsAIGenerating(false)
    }
  }

  const cardIds = lane.cards.map((card) => card.id)

  async function handleQuickCreate() {
    if (!quickTitle.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, laneId: lane.id, title: quickTitle.trim() }),
      })
      if (!response.ok) throw new Error('Failed to create card')
      const result = await response.json()
      if (result.success) {
        onLaneUpdate({ ...lane, cards: [...lane.cards, result.data] })
        setQuickTitle('')
        setTimeout(() => quickInputRef.current?.focus(), 0)
      }
    } catch {
      // 可以添加简单的错误提示
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn('kanban-lane pixel-office-lane group flex h-full w-64 shrink-0 flex-col rounded-xl border border-border/80 bg-muted px-2 py-2.5 shadow-[0_4px_16px_rgba(22,18,13,0.04)]', isHovered && 'border-primary/25 bg-muted/80')}>
      <div className="pixel-lane-animation" aria-hidden="true">
        <span className="pixel-lane-board-sign">{lane.title.slice(0, 4)}</span>
        <span className="pixel-lane-screen" />
        <span className="pixel-lane-desk" />
        <span className="pixel-lane-actor">
          <span className="pixel-lane-bubble">处理中</span>
          <span className="pixel-lane-head" />
          <span className="pixel-lane-body" />
          <span className="pixel-lane-arm pixel-lane-arm-left" />
          <span className="pixel-lane-arm pixel-lane-arm-right" />
          <span className="pixel-lane-leg pixel-lane-leg-left" />
          <span className="pixel-lane-leg pixel-lane-leg-right" />
        </span>
        <span className="pixel-lane-spark pixel-lane-spark-a" />
        <span className="pixel-lane-spark pixel-lane-spark-b" />
      </div>
      {/* 列表头部 */}
      <div className="mb-2 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/70 cursor-grab" />
          <h2
            className="cursor-pointer text-[13px] font-semibold text-foreground hover:text-primary"
            onDoubleClick={() => setShowEditLane(true)}
          >
            {lane.title}
          </h2>
          <span className="rounded-md bg-background/80 px-1.5 py-0 text-[10px] text-muted-foreground font-medium">{lane.cards.length}</span>
        </div>
        <div className="relative flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 text-muted-foreground group-hover:opacity-100 hover:text-foreground"
            onClick={() => setShowLaneActionsMenu((v) => !v)}
            aria-label="更多列表操作"
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
          {showLaneActionsMenu && (
            <div className="absolute right-0 top-7 z-20 w-36 rounded-xl border border-border/90 bg-white/95 p-1.5 shadow-[0_12px_28px_rgba(26,20,14,0.12)] backdrop-blur-sm">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary"
                onClick={() => {
                  setShowLaneActionsMenu(false)
                  onOpenAI?.(lane.id, lane.title)
                }}
              >
                <Wand2 className="h-3 w-3 text-muted-foreground" />
                AI 生成卡片
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary"
                onClick={() => {
                  setShowLaneActionsMenu(false)
                  setShowEditLane(true)
                }}
              >
                <Edit2 className="h-3 w-3 text-muted-foreground" />
                编辑列表
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 卡片列表（拖放区域） */}
      <div
        ref={setNodeRef}
        className={cn(
          'kanban-card-list relative z-[2] flex-1 overflow-y-auto rounded-lg bg-background/70 min-h-[80px] space-y-1 py-1.5',
          isHovered && 'bg-background/60'
        )}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {lane.cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              onEdit={onCardEdit}
              selected={selectedCardIds?.has(card.id)}
              selectionMode={selectionMode}
              onSelectToggle={onCardSelectToggle}
              onSelectRange={onCardSelectRange}
            />
          ))}

          {lane.cards.length === 0 && (
            <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30 text-xs text-muted-foreground/70">
              暂无卡片
            </div>
          )}
        </SortableContext>
      </div>

      {/* AI 内联生成 */}
      {!isAIInputOpen ? (
        <Button
          variant="ghost"
          className="mt-1 h-7 justify-start px-2 text-xs text-muted-foreground/70 hover:text-primary"
          onClick={() => {
            setIsAIInputOpen(true)
            setTimeout(() => aiInputRef.current?.focus(), 0)
          }}
          aria-label="用 AI 生成卡片"
        >
          <Sparkles className="mr-1.5 h-3 w-3" />
          用 AI 生成卡片…
        </Button>
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <Input
            ref={aiInputRef}
            autoFocus
            placeholder="描述需求，按 Enter 生成"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAIGenerate()
              } else if (e.key === 'Escape') {
                setIsAIInputOpen(false)
                setAiQuery('')
              }
            }}
            onBlur={() => {
              if (!aiQuery.trim() && !isAIGenerating) {
                setIsAIInputOpen(false)
                setAiQuery('')
              }
            }}
            disabled={isAIGenerating}
            className="h-7 text-xs"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => {
              setIsAIInputOpen(false)
              setAiQuery('')
            }}
            disabled={isAIGenerating}
          >
            取消
          </Button>
        </div>
      )}

      {/* 快速创建卡片 */}
      {!isQuickAdding ? (
        <Button
          variant="ghost"
          className="mt-1 h-8 justify-start px-2 text-muted-foreground hover:text-foreground"
          onClick={() => setIsQuickAdding(true)}
          aria-label="添加卡片"
          data-quick-add-btn
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          添加卡片
        </Button>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <Input
            ref={quickInputRef}
            autoFocus
            placeholder="输入卡片标题，按 Enter 创建"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleQuickCreate()
              } else if (e.key === 'Escape') {
                setIsQuickAdding(false)
                setQuickTitle('')
              }
            }}
            onBlur={() => {
              if (!quickTitle.trim()) {
                setIsQuickAdding(false)
                setQuickTitle('')
              }
            }}
            disabled={isSubmitting}
            className="h-8 text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={() => {
              setIsQuickAdding(false)
              setQuickTitle('')
            }}
            disabled={isSubmitting}
          >
            取消
          </Button>
        </div>
      )}

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
})

export const LaneItem = memo(function LaneItem({ lane, onLaneUpdate, onCardEdit, isHovered, onLaneDeleted, boardId, selectionMode, selectedCardIds, onCardSelectToggle, onCardSelectRange, onOpenAI }: LaneItemProps) {
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
        selectionMode={selectionMode}
        selectedCardIds={selectedCardIds}
        onCardSelectToggle={onCardSelectToggle}
        onCardSelectRange={onCardSelectRange}
        onOpenAI={onOpenAI}
      />
    </div>
  )
})
