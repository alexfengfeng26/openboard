'use client'

import { useReducer, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, DragOverEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import type { Board, Lane, Card } from '@/lib/db'
import { LaneItem } from '@/components/lane/LaneItem'
import { EditCardDialog } from '@/components/card/EditCardDialog'
import { CardItem } from '@/components/card/CardItem'
import { findCardById, getCardLaneId, getDragType, isValidDragEnd } from '@/lib/drag-utils'
import { toastError } from '@/components/ui/toast'
import { MessageCircle, Plus, Sparkles, LayoutGrid } from 'lucide-react'
import { CreateLaneDialog } from '@/components/lane/CreateLaneDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DeepSeekChatPanel } from '@/components/ai/DeepSeekChatPanel'
import { BoardSelector } from './BoardSelector'
import { cn } from '@/lib/utils'

interface BoardClientProps {
  initialBoard: Board
  initialBoards: Array<{ id: string; title: string; createdAt: string; updatedAt: string }>
}

// State type
type BoardClientState = {
  board: Board
  boards: Array<{ id: string; title: string; createdAt: string; updatedAt: string }>
  activeId: string | null
  activeType: 'CARD' | 'LANE' | null
  showCreateLane: boolean
  editingCard: Card | null
  hoveredLaneId: string | null
  showChat: boolean
}

// Action types
type BoardClientAction =
  | { type: 'SET_BOARD'; payload: Board }
  | { type: 'SET_BOARDS'; payload: Array<{ id: string; title: string; createdAt: string; updatedAt: string }> }
  | { type: 'SET_ACTIVE_ID'; payload: string | null }
  | { type: 'SET_ACTIVE_TYPE'; payload: 'CARD' | 'LANE' | null }
  | { type: 'SET_SHOW_CREATE_LANE'; payload: boolean }
  | { type: 'SET_EDITING_CARD'; payload: Card | null }
  | { type: 'SET_HOVERED_LANE_ID'; payload: string | null }
  | { type: 'SET_SHOW_CHAT'; payload: boolean }
  | { type: 'UPDATE_LANE'; payload: Lane }
  | { type: 'DELETE_LANE'; payload: string }
  | { type: 'UPDATE_CARD'; payload: Card }
  | { type: 'DELETE_CARD'; payload: Card }
  | { type: 'ADD_LANE'; payload: Lane }
  | { type: 'ADD_CARD_TO_LANE'; payload: { laneId: string; card: Card } }

function boardClientReducer(state: BoardClientState, action: BoardClientAction): BoardClientState {
  switch (action.type) {
    case 'SET_BOARD':
      return { ...state, board: action.payload }
    case 'SET_BOARDS':
      return { ...state, boards: action.payload }
    case 'SET_ACTIVE_ID':
      return { ...state, activeId: action.payload }
    case 'SET_ACTIVE_TYPE':
      return { ...state, activeType: action.payload }
    case 'SET_SHOW_CREATE_LANE':
      return { ...state, showCreateLane: action.payload }
    case 'SET_EDITING_CARD':
      return { ...state, editingCard: action.payload }
    case 'SET_HOVERED_LANE_ID':
      return { ...state, hoveredLaneId: action.payload }
    case 'SET_SHOW_CHAT':
      return { ...state, showChat: action.payload }
    case 'UPDATE_LANE':
      return {
        ...state,
        board: {
          ...state.board,
          lanes: state.board.lanes.map((l) => (l.id === action.payload.id ? action.payload : l)),
        },
      }
    case 'DELETE_LANE':
      return {
        ...state,
        board: {
          ...state.board,
          lanes: state.board.lanes.filter((l) => l.id !== action.payload),
        },
      }
    case 'UPDATE_CARD':
      return {
        ...state,
        board: {
          ...state.board,
          lanes: state.board.lanes.map((lane) => ({
            ...lane,
            cards: lane.cards.map((c) => (c.id === action.payload.id ? action.payload : c)),
          })),
        },
      }
    case 'DELETE_CARD':
      {
        const laneId = action.payload.laneId
        const cardId = action.payload.id
        return {
          ...state,
          board: {
            ...state.board,
            lanes: state.board.lanes.map((lane) => {
              if (lane.id !== laneId) return lane
              const index = lane.cards.findIndex((c) => c.id === cardId)
              if (index === -1) return lane
              const nextCards = [...lane.cards]
              nextCards.splice(index, 1)
              return { ...lane, cards: nextCards }
            }),
          },
        }
      }
    case 'ADD_LANE':
      return {
        ...state,
        board: {
          ...state.board,
          lanes: [...state.board.lanes, action.payload],
        },
      }
    case 'ADD_CARD_TO_LANE':
      return {
        ...state,
        board: {
          ...state.board,
          lanes: state.board.lanes.map((lane) =>
            lane.id === action.payload.laneId
              ? { ...lane, cards: [...lane.cards, action.payload.card] }
              : lane
          ),
        },
      }
    default:
      return state
  }
}

export function BoardClient({ initialBoard, initialBoards }: BoardClientProps) {
  const [state, dispatch] = useReducer(boardClientReducer, {
    board: initialBoard,
    boards: initialBoards,
    activeId: null,
    activeType: null,
    showCreateLane: false,
    editingCard: null,
    hoveredLaneId: null,
    showChat: false,
  })

  const { board, boards, activeId, activeType, showCreateLane, editingCard, hoveredLaneId, showChat } = state

  // 刷新看板列表
  const refreshBoards = useCallback(async () => {
    try {
      const response = await fetch('/api/boards')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          dispatch({ type: 'SET_BOARDS', payload: result.data })
        }
      }
    } catch (error) {
      toastError('获取看板列表失败')
    }
  }, [])
 
  const refreshCurrentBoard = useCallback(async () => {
    try {
      const response = await fetch(`/api/boards/${state.board.id}`)
      if (!response.ok) return
      const result = await response.json().catch(() => ({}))
      if (result?.success && result.data) {
        dispatch({ type: 'SET_BOARD', payload: result.data })
      }
    } catch {
      toastError('刷新看板失败')
    }
  }, [state.board.id])

  // 配置拖放传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  )

  // 拖放开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    dispatch({ type: 'SET_ACTIVE_ID', payload: active.id as string })
    dispatch({ type: 'SET_ACTIVE_TYPE', payload: getDragType(active) })
  }, [])

  // 拖放移动
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) {
      dispatch({ type: 'SET_HOVERED_LANE_ID', payload: null })
      return
    }

    let laneId = over.id as string
    const overType = getDragType(over)

    if (overType === 'CARD') {
      const card = findCardById(board.lanes, over.id as string)
      if (card) {
        laneId = card.laneId
      }
    }

    dispatch({ type: 'SET_HOVERED_LANE_ID', payload: laneId })
  }, [board])

  // 拖放结束
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    dispatch({ type: 'SET_ACTIVE_ID', payload: null })
    dispatch({ type: 'SET_ACTIVE_TYPE', payload: null })
    dispatch({ type: 'SET_HOVERED_LANE_ID', payload: null })

    if (!over || !isValidDragEnd(event)) {
      return
    }

    const type = getDragType(active)

    if (type === 'CARD') {
      const cardId = active.id as string
      const fromLaneId = getCardLaneId(active)
      let toLaneId = over.id as string
      const overType = getDragType(over)

      if (overType === 'CARD') {
        const droppedCard = findCardById(board.lanes, over.id as string)
        if (droppedCard) {
          toLaneId = droppedCard.laneId
        }
      }

      const toLane = board.lanes.find((l) => l.id === toLaneId)

      if (!fromLaneId || !toLane) {
        return
      }

      if (fromLaneId === toLaneId) {
        const fromLane = board.lanes.find((l) => l.id === fromLaneId)
        if (!fromLane) return

        const oldIndex = fromLane.cards.findIndex((c) => c.id === cardId)
        const newIndex = fromLane.cards.findIndex((c) => c.id === over.id)

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return
        }

        const updatedCards = arrayMove(fromLane.cards, oldIndex, newIndex)
        const updatedLanes = board.lanes.map((lane) =>
          lane.id === fromLaneId ? { ...lane, cards: updatedCards } : lane
        )

        dispatch({ type: 'SET_BOARD', payload: { ...board, lanes: updatedLanes } })

        try {
          const response = await fetch('/api/cards/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              boardId: board.id,
              laneId: fromLaneId,
              cardIds: updatedCards.map((c) => c.id),
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to reorder cards')
          }
        } catch (error) {
          dispatch({ type: 'SET_BOARD', payload: board })
        }
        return
      }

      let newPosition = toLane.cards.length

      if (overType === 'CARD') {
        const targetCardIndex = toLane.cards.findIndex((c) => c.id === over.id)
        if (targetCardIndex !== -1) {
          newPosition = toLane.cards[targetCardIndex].position
        }
      }

      const updatedLanes = board.lanes.map((lane) => {
        if (lane.id === fromLaneId) {
          return {
            ...lane,
            cards: lane.cards.filter((c) => c.id !== cardId),
          }
        }
        if (lane.id === toLaneId) {
          const card = findCardById(board.lanes, cardId)
          if (card) {
            const insertIndex = overType === 'CARD' && toLane.cards.findIndex((c) => c.id === over.id) !== -1
              ? toLane.cards.findIndex((c) => c.id === over.id)
              : toLane.cards.length

            const newCards = [...toLane.cards]
            newCards.splice(insertIndex, 0, { ...card, laneId: toLaneId, position: newPosition })

            return {
              ...lane,
              cards: newCards,
            }
          }
        }
        return lane
      })

      dispatch({ type: 'SET_BOARD', payload: { ...board, lanes: updatedLanes } })

      try {
        const response = await fetch('/api/cards/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardId: board.id, cardId, toLaneId, newPosition }),
        })

        if (!response.ok) {
          throw new Error('Failed to move card')
        }
      } catch (error) {
        dispatch({ type: 'SET_BOARD', payload: board })
      }
    }

    if (type === 'LANE') {
      const oldIndex = board.lanes.findIndex((l) => l.id === active.id)
      const newIndex = board.lanes.findIndex((l) => l.id === over.id)

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return
      }

      const updatedLanes = arrayMove(board.lanes, oldIndex, newIndex)
      updatedLanes.forEach((lane, index) => {
        lane.position = index
      })

      dispatch({ type: 'SET_BOARD', payload: { ...board, lanes: updatedLanes } })

      try {
        const response = await fetch('/api/lanes/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boardId: board.id,
            laneIds: updatedLanes.map((l) => l.id),
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to reorder lanes')
        }
      } catch (error) {
        dispatch({ type: 'SET_BOARD', payload: board })
      }
    }
  }, [board])

  // 添加列表
  const handleAddLane = useCallback(async (title: string) => {
    try {
      const response = await fetch('/api/lanes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: board.id, title }),
      })

      if (!response.ok) {
        throw new Error('Failed to create lane')
      }

      const result = await response.json()

      if (result.success) {
        dispatch({ type: 'ADD_LANE', payload: result.data })
        dispatch({ type: 'SET_SHOW_CREATE_LANE', payload: false })
      }
    } catch (error) {
      toastError('创建列表失败')
    }
  }, [board.id])

  // 编辑卡片
  const handleCardEdit = useCallback((card: Card) => {
    dispatch({ type: 'SET_EDITING_CARD', payload: card })
  }, [])

  // 卡片更新后的回调
  const handleCardUpdated = useCallback((updatedCard: Card) => {
    dispatch({ type: 'UPDATE_CARD', payload: updatedCard })
    dispatch({ type: 'SET_EDITING_CARD', payload: null })
  }, [])

  // 卡片删除后的回调
  const handleCardDeleted = useCallback(() => {
    if (!editingCard) return
    dispatch({ type: 'DELETE_CARD', payload: editingCard })
    dispatch({ type: 'SET_EDITING_CARD', payload: null })
  }, [editingCard])

  const handleCardCreatedFromChat = useCallback((laneId: string, card: Card) => {
    dispatch({ type: 'ADD_CARD_TO_LANE', payload: { laneId, card } })
  }, [])

  // 获取正在拖拽的卡片
  const activeCard = activeId && activeType === 'CARD' ? findCardById(board.lanes, activeId) : null

  return (
    <div className="flex h-screen w-full">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* 顶部导航栏 */}
        <header className="relative z-50 border-b border-slate-200/60 bg-white/70 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
                  <LayoutGrid className="h-4 w-4 text-white" />
                </div>
                <BoardSelector
                  boards={boards}
                  currentBoard={board}
                  onBoardChange={(newBoard) => dispatch({ type: 'SET_BOARD', payload: newBoard })}
                  onBoardsRefresh={refreshBoards}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="md:hidden gap-1.5"
                onClick={() => dispatch({ type: 'SET_SHOW_CHAT', payload: true })}
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <span>AI 助手</span>
              </Button>
              <Button 
                size="sm" 
                className="gap-1.5"
                onClick={() => dispatch({ type: 'SET_SHOW_CREATE_LANE', payload: true })}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>添加列表</span>
              </Button>
            </div>
          </div>
        </header>

        {/* 看板主体区域 */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            collisionDetection={closestCenter}
          >
            <SortableContext items={board.lanes.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex h-full items-stretch gap-4">
                {board.lanes.map((lane) => (
                  <LaneItem
                    key={lane.id}
                    lane={lane}
                    boardId={board.id}
                    isHovered={hoveredLaneId === lane.id}
                    onLaneUpdate={(updatedLane) => {
                      dispatch({ type: 'UPDATE_LANE', payload: updatedLane })
                    }}
                    onCardEdit={handleCardEdit}
                    onLaneDeleted={(laneId) => {
                      dispatch({ type: 'DELETE_LANE', payload: laneId })
                    }}
                  />
                ))}

                {/* 添加列表按钮 */}
                <button
                  onClick={() => dispatch({ type: 'SET_SHOW_CREATE_LANE', payload: true })}
                  className={cn(
                    'flex h-full w-64 shrink-0 flex-col items-center justify-center rounded-2xl',
                    'border-2 border-dashed border-slate-300/60',
                    'bg-slate-50/50 text-slate-500',
                    'transition-all duration-300',
                    'hover:border-indigo-400/60 hover:bg-indigo-50/30 hover:text-indigo-600',
                    'group'
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 group-hover:bg-indigo-100 transition-colors mb-3">
                    <Plus className="h-6 w-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-sm font-medium">添加列表</span>
                </button>
              </div>
            </SortableContext>

            {/* 拖放时的覆盖层 */}
            <DragOverlay>
              {activeCard && (
                <div className="react-kanban-drag-overlay w-64 rotate-2 rounded-xl bg-white p-3 shadow-2xl">
                  <CardItem card={activeCard} isDragging />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* AI 聊天侧边栏 */}
      <aside className="hidden h-screen w-[420px] shrink-0 flex-col border-l border-slate-200/60 bg-white/60 backdrop-blur-xl md:flex shadow-xl shadow-slate-900/5">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-slate-200/60 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">AI 助手</h2>
              <p className="text-[11px] text-slate-500">DeepSeek 智能助手</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <DeepSeekChatPanel
              lanes={board.lanes}
              linkedCard={editingCard}
              onCardCreated={handleCardCreatedFromChat}
              onBoardRefresh={refreshCurrentBoard}
              boardId={board.id}
            />
          </div>
        </div>
      </aside>

      {/* 移动端聊天对话框 */}
      <Dialog open={showChat} onOpenChange={(open) => dispatch({ type: 'SET_SHOW_CHAT', payload: open })}>
        <DialogContent className="w-[min(92vw,640px)] sm:rounded-2xl overflow-hidden">
          <DialogHeader className="px-4 pt-4 border-b border-slate-200/60">
            <div className="flex items-center gap-2 pb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <DialogTitle className="text-base">AI 助手</DialogTitle>
            </div>
          </DialogHeader>
          <div className="h-[70vh]">
            <DeepSeekChatPanel
              lanes={board.lanes}
              linkedCard={editingCard}
              onCardCreated={handleCardCreatedFromChat}
              onBoardRefresh={refreshCurrentBoard}
              boardId={board.id}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 创建列表对话框 */}
      <CreateLaneDialog
        open={showCreateLane}
        onOpenChange={(open) => dispatch({ type: 'SET_SHOW_CREATE_LANE', payload: open })}
        onLaneCreated={handleAddLane}
      />

      {/* 编辑卡片对话框 */}
      {editingCard && (
        <EditCardDialog
          open={!!editingCard}
          onOpenChange={(open) => !open && dispatch({ type: 'SET_EDITING_CARD', payload: null })}
          card={editingCard}
          boardId={board.id}
          onCardUpdated={handleCardUpdated}
          onCardDeleted={handleCardDeleted}
        />
      )}
    </div>
  )
}
