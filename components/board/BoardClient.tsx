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
import { MessageCircle, Plus } from 'lucide-react'
import { CreateLaneDialog } from '@/components/lane/CreateLaneDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DeepSeekChatPanel } from '@/components/ai/DeepSeekChatPanel'
import { BoardSelector } from './BoardSelector'

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

  // 配置拖放传感器 - 使用更宽松的设置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // 降低拖动阈值，更容易触发
      },
    })
  )

  // 拖放开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    dispatch({ type: 'SET_ACTIVE_ID', payload: active.id as string })
    dispatch({ type: 'SET_ACTIVE_TYPE', payload: getDragType(active) })
  }, [])

  // 拖放移动 - 实时更新悬停的列表
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) {
      dispatch({ type: 'SET_HOVERED_LANE_ID', payload: null })
      return
    }

    // 确定悬停的列表 ID
    let laneId = over.id as string
    const overType = getDragType(over)

    // 如果悬停在卡片上，找到该卡片所属的列表
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

    // 重置状态
    dispatch({ type: 'SET_ACTIVE_ID', payload: null })
    dispatch({ type: 'SET_ACTIVE_TYPE', payload: null })
    dispatch({ type: 'SET_HOVERED_LANE_ID', payload: null })

    // 验证拖放
    if (!over || !isValidDragEnd(event)) {
      return
    }

    const type = getDragType(active)

    // 处理卡片拖放
    if (type === 'CARD') {
      const cardId = active.id as string
      const fromLaneId = getCardLaneId(active)

      // 确定目标列表 ID
      // over.id 可能是列表 ID 或卡片 ID
      let toLaneId = over.id as string
      const overType = getDragType(over)

      // 如果拖放到卡片上，找到该卡片所属的列表
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

      // 同列表内重排序
      if (fromLaneId === toLaneId) {
        const fromLane = board.lanes.find((l) => l.id === fromLaneId)
        if (!fromLane) return

        const oldIndex = fromLane.cards.findIndex((c) => c.id === cardId)
        const newIndex = fromLane.cards.findIndex((c) => c.id === over.id)

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return
        }

        // 使用 arrayMove 进行同列表内重排序
        const updatedCards = arrayMove(fromLane.cards, oldIndex, newIndex)

        // 乐观更新 UI
        const updatedLanes = board.lanes.map((lane) =>
          lane.id === fromLaneId ? { ...lane, cards: updatedCards } : lane
        )

        dispatch({ type: 'SET_BOARD', payload: { ...board, lanes: updatedLanes } })

        // 调用 API 保存新位置
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
          // 失败则回滚
          dispatch({ type: 'SET_BOARD', payload: board })
        }
        return
      }

      // 跨列表移动：计算新位置（插入到目标卡片之前）
      let newPosition = toLane.cards.length // 默认放到末尾

      if (overType === 'CARD') {
        // 如果拖放到卡片上，插入到该卡片之前的位置
        const targetCardIndex = toLane.cards.findIndex((c) => c.id === over.id)
        if (targetCardIndex !== -1) {
          // 使用目标卡片的 position
          newPosition = toLane.cards[targetCardIndex].position
        }
      }

      // 乐观更新 UI
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
            // 根据 newPosition 插入到正确位置
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

      // 调用 API
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
        // 失败则回滚
        dispatch({ type: 'SET_BOARD', payload: board })
      }
    }

    // 处理列表拖放
    if (type === 'LANE') {
      const oldIndex = board.lanes.findIndex((l) => l.id === active.id)
      const newIndex = board.lanes.findIndex((l) => l.id === over.id)

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return
      }

      // 使用 arrayMove 进行列表重排序
      const updatedLanes = arrayMove(board.lanes, oldIndex, newIndex)

      // 更新 position 值
      updatedLanes.forEach((lane, index) => {
        lane.position = index
      })

      dispatch({ type: 'SET_BOARD', payload: { ...board, lanes: updatedLanes } })

      // 调用 API 保存新位置
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
        // 失败则回滚
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
    console.log('[handleCardCreatedFromChat] 卡片已添加到 UI:', { laneId, cardTitle: card.title })
  }, [])

  // 获取正在拖拽的卡片
  const activeCard = activeId && activeType === 'CARD' ? findCardById(board.lanes, activeId) : null

  return (
    <div className="flex h-screen w-full">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-50 border-b bg-white/80 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <BoardSelector
              boards={boards}
              currentBoard={board}
              onBoardChange={(newBoard) => dispatch({ type: 'SET_BOARD', payload: newBoard })}
              onBoardsRefresh={refreshBoards}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="md:hidden" onClick={() => dispatch({ type: 'SET_SHOW_CHAT', payload: true })}>
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                Chat
              </Button>
              <Button size="sm" onClick={() => dispatch({ type: 'SET_SHOW_CREATE_LANE', payload: true })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                添加列表
              </Button>
            </div>
          </div>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            collisionDetection={closestCenter}
          >
            <SortableContext items={board.lanes.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex h-full items-stretch gap-3">
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

                <button
                  onClick={() => dispatch({ type: 'SET_SHOW_CREATE_LANE', payload: true })}
                  className="flex h-full w-56 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/35 hover:bg-muted/50"
                >
                  <Plus className="mb-1.5 h-6 w-6" />
                  <span className="font-medium">添加列表</span>
                </button>
              </div>
            </SortableContext>

            <DragOverlay>
              {activeCard && (
                <div className="react-kanban-drag-overlay w-56 rotate-3 rounded-lg bg-white p-3 shadow-lg">
                  <CardItem card={activeCard} isDragging />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <aside className="hidden h-screen w-[380px] shrink-0 flex-col border-l bg-white/80 backdrop-blur md:flex">
        <DeepSeekChatPanel
          lanes={board.lanes}
          linkedCard={editingCard}
          onCardCreated={handleCardCreatedFromChat}
          onBoardRefresh={refreshCurrentBoard}
          boardId={board.id}
        />
      </aside>

      <Dialog open={showChat} onOpenChange={(open) => dispatch({ type: 'SET_SHOW_CHAT', payload: open })}>
        <DialogContent className="w-[min(92vw,640px)] p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>DeepSeek Chat</DialogTitle>
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
