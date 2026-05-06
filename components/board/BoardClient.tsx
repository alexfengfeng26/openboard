'use client'

import { useReducer, useCallback, useRef, useState, useEffect } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import type { Board, Lane, Card, Tag } from '@/lib/db'
import { LaneItem } from '@/components/lane/LaneItem'
import { EditCardDialog } from '@/components/card/EditCardDialog'
import { CardItem } from '@/components/card/CardItem'
import { findCardById, getCardLaneId, getDragType, isValidDragEnd } from '@/lib/drag-utils'
import { toastError, toastSuccess } from '@/components/ui/toast'
import {
  Plus,
  Sparkles,
  LayoutGrid,
  GripVertical,
  Search,
  X,
  CheckSquare,
  Move,
  Trash2,
  Tag as TagIcon,
  Keyboard,
} from 'lucide-react'
import { CreateLaneDialog } from '@/components/lane/CreateLaneDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { KeyboardHelp } from '@/components/ui/keyboard-help'
import { DeepSeekChatPanel } from '@/components/ai/DeepSeekChatPanel'
import { BoardSelector } from './BoardSelector'
import { BoardTagsProvider } from './BoardTagsContext'
import { cn } from '@/lib/utils'
import { useCardSearch } from '@/lib/hooks/useCardSearch'
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts'
import { TagSelector } from '@/components/card/TagSelector'
import { ErrorBoundary } from '@/components/ui/error-boundary'

interface BoardClientProps {
  initialBoard: Board
  initialBoards: Array<{ id: string; title: string; createdAt: string; updatedAt: string; archivedAt?: string }>
}

// State type
type BoardClientState = {
  board: Board
  boards: Array<{ id: string; title: string; createdAt: string; updatedAt: string; archivedAt?: string }>
  activeId: string | null
  activeType: 'CARD' | 'LANE' | null
  showCreateLane: boolean
  editingCard: Card | null
  hoveredLaneId: string | null
  showChat: boolean
  selectionMode: boolean
  selectedCardIds: Set<string>
  showBatchMoveDialog: boolean
  showBatchTagDialog: boolean
}

// Action types
type BoardClientAction =
  | { type: 'SET_BOARD'; payload: Board }
  | { type: 'SET_BOARDS'; payload: Array<{ id: string; title: string; createdAt: string; updatedAt: string; archivedAt?: string }> }
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
  | { type: 'TOGGLE_SELECTION_MODE' }
  | { type: 'TOGGLE_CARD_SELECTION'; payload: string }
  | { type: 'SELECT_RANGE'; payload: { fromCardId: string; toCardId: string } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_SHOW_BATCH_MOVE_DIALOG'; payload: boolean }
  | { type: 'SET_SHOW_BATCH_TAG_DIALOG'; payload: boolean }

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
    case 'DELETE_CARD': {
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
    case 'TOGGLE_SELECTION_MODE':
      return {
        ...state,
        selectionMode: !state.selectionMode,
        selectedCardIds: new Set<string>(),
      }
    case 'TOGGLE_CARD_SELECTION': {
      const next = new Set(state.selectedCardIds)
      if (next.has(action.payload)) next.delete(action.payload)
      else next.add(action.payload)
      return { ...state, selectedCardIds: next }
    }
    case 'SELECT_RANGE': {
      const allCards: Card[] = []
      for (const lane of state.board.lanes) {
        for (const card of lane.cards) {
          allCards.push(card)
        }
      }
      const fromIndex = allCards.findIndex((c) => c.id === action.payload.fromCardId)
      const toIndex = allCards.findIndex((c) => c.id === action.payload.toCardId)
      if (fromIndex === -1 || toIndex === -1) return state
      const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex]
      const next = new Set(state.selectedCardIds)
      for (let i = start; i <= end; i++) {
        next.add(allCards[i].id)
      }
      return { ...state, selectedCardIds: next }
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectionMode: false, selectedCardIds: new Set<string>() }
    case 'SET_SHOW_BATCH_MOVE_DIALOG':
      return { ...state, showBatchMoveDialog: action.payload }
    case 'SET_SHOW_BATCH_TAG_DIALOG':
      return { ...state, showBatchTagDialog: action.payload }
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
    selectionMode: false,
    selectedCardIds: new Set<string>(),
    showBatchMoveDialog: false,
    showBatchTagDialog: false,
  })

  const {
    board,
    boards,
    activeId,
    activeType,
    showCreateLane,
    editingCard,
    hoveredLaneId,
    showChat,
    selectionMode,
    selectedCardIds,
    showBatchMoveDialog,
    showBatchTagDialog,
  } = state

  // 使用 useRef 缓存 board，避免 handleDragEnd 频繁重建
  const boardRef = useRef(board)
  boardRef.current = board

  const [boardTags, setBoardTags] = useState<Tag[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch('/api/tags')
        const result = await response.json()
        if (result.success) {
          setBoardTags(result.data)
        }
      } catch {
        // 静默失败
      }
    }
    fetchTags()
  }, [])

  // 搜索
  const {
    filters,
    setQuery,
    filteredBoard,
    resultCount,
    clearFilters,
  } = useCardSearch(board)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // 刷新看板列表
  const refreshBoards = useCallback(async () => {
    try {
      const response = await fetch('/api/boards?includeArchived=true')
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
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
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
    const currentBoard = boardRef.current
    const { active, over } = event
    if (!over) {
      dispatch({ type: 'SET_HOVERED_LANE_ID', payload: null })
      return
    }

    let laneId = over.id as string
    const overType = getDragType(over)

    if (overType === 'CARD') {
      const card = findCardById(currentBoard.lanes, over.id as string)
      if (card) {
        laneId = card.laneId
      }
    }

    dispatch({ type: 'SET_HOVERED_LANE_ID', payload: laneId })
  }, [])

  // 拖放结束
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const currentBoard = boardRef.current
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
        const droppedCard = findCardById(currentBoard.lanes, over.id as string)
        if (droppedCard) {
          toLaneId = droppedCard.laneId
        }
      }

      const toLane = currentBoard.lanes.find((l) => l.id === toLaneId)

      if (!fromLaneId || !toLane) {
        return
      }

      if (fromLaneId === toLaneId) {
        const fromLane = currentBoard.lanes.find((l) => l.id === fromLaneId)
        if (!fromLane) return

        const oldIndex = fromLane.cards.findIndex((c) => c.id === cardId)
        const newIndex = fromLane.cards.findIndex((c) => c.id === over.id)

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return
        }

        const updatedCards = arrayMove(fromLane.cards, oldIndex, newIndex)
        const updatedLanes = currentBoard.lanes.map((lane) =>
          lane.id === fromLaneId ? { ...lane, cards: updatedCards } : lane
        )

        dispatch({ type: 'SET_BOARD', payload: { ...currentBoard, lanes: updatedLanes } })

        try {
          const response = await fetch('/api/cards/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              boardId: currentBoard.id,
              laneId: fromLaneId,
              cardIds: updatedCards.map((c) => c.id),
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to reorder cards')
          }
        } catch (error) {
          dispatch({ type: 'SET_BOARD', payload: currentBoard })
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

      const updatedLanes = currentBoard.lanes.map((lane) => {
        if (lane.id === fromLaneId) {
          return {
            ...lane,
            cards: lane.cards.filter((c) => c.id !== cardId),
          }
        }
        if (lane.id === toLaneId) {
          const card = findCardById(currentBoard.lanes, cardId)
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

      dispatch({ type: 'SET_BOARD', payload: { ...currentBoard, lanes: updatedLanes } })

      try {
        const response = await fetch('/api/cards/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardId: currentBoard.id, cardId, toLaneId, newPosition }),
        })

        if (!response.ok) {
          throw new Error('Failed to move card')
        }
      } catch (error) {
        dispatch({ type: 'SET_BOARD', payload: currentBoard })
      }
    }

    if (type === 'LANE') {
      const oldIndex = currentBoard.lanes.findIndex((l) => l.id === active.id)
      const newIndex = currentBoard.lanes.findIndex((l) => l.id === over.id)

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return
      }

      const updatedLanes = arrayMove(currentBoard.lanes, oldIndex, newIndex)
      updatedLanes.forEach((lane, index) => {
        lane.position = index
      })

      dispatch({ type: 'SET_BOARD', payload: { ...currentBoard, lanes: updatedLanes } })

      try {
        const response = await fetch('/api/lanes/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boardId: currentBoard.id,
            laneIds: updatedLanes.map((l) => l.id),
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to reorder lanes')
        }
      } catch (error) {
        dispatch({ type: 'SET_BOARD', payload: currentBoard })
      }
    }
  }, [])

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

  const handleLaneUpdate = useCallback((updatedLane: Lane) => {
    dispatch({ type: 'UPDATE_LANE', payload: updatedLane })
  }, [])

  const handleLaneDeleted = useCallback((laneId: string) => {
    dispatch({ type: 'DELETE_LANE', payload: laneId })
  }, [])

  // 选择相关
  const lastSelectedCardIdRef = useRef<string | null>(null)

  const handleCardSelectToggle = useCallback((cardId: string) => {
    dispatch({ type: 'TOGGLE_CARD_SELECTION', payload: cardId })
    lastSelectedCardIdRef.current = cardId
  }, [])

  const handleCardSelectRange = useCallback((toCardId: string) => {
    if (!lastSelectedCardIdRef.current) return
    dispatch({
      type: 'SELECT_RANGE',
      payload: { fromCardId: lastSelectedCardIdRef.current, toCardId },
    })
  }, [])

  // 批量操作
  const handleBatchMove = useCallback(async (toLaneId: string) => {
    const cardIds = Array.from(selectedCardIds)
    if (cardIds.length === 0) return

    const cardIdSet = new Set(cardIds)
    const previousBoard = board
    const cardsToMove = board.lanes
      .flatMap((l) => l.cards)
      .filter((c) => cardIdSet.has(c.id))
      .map((c) => ({ ...c, laneId: toLaneId }))

    const updatedLanes = board.lanes.map((lane) => {
      if (lane.id === toLaneId) {
        return { ...lane, cards: [...lane.cards, ...cardsToMove] }
      }
      return { ...lane, cards: lane.cards.filter((c) => !cardIdSet.has(c.id)) }
    })

    dispatch({ type: 'SET_BOARD', payload: { ...board, lanes: updatedLanes } })
    dispatch({ type: 'CLEAR_SELECTION' })

    try {
      const response = await fetch('/api/cards/batch-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: board.id, cardIds, toLaneId }),
      })
      if (!response.ok) throw new Error('Failed to batch move')
      toastSuccess(`已移动 ${cardIds.length} 张卡片`)
      await refreshCurrentBoard()
    } catch {
      toastError('批量移动失败')
      dispatch({ type: 'SET_BOARD', payload: previousBoard })
    }
  }, [board, selectedCardIds, refreshCurrentBoard])

  const handleBatchDelete = useCallback(async () => {
    const cardIds = Array.from(selectedCardIds)
    if (cardIds.length === 0) return

    const cardIdSet = new Set(cardIds)
    const previousBoard = board
    const updatedLanes = board.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.filter((c) => !cardIdSet.has(c.id)),
    }))

    dispatch({ type: 'SET_BOARD', payload: { ...board, lanes: updatedLanes } })
    dispatch({ type: 'CLEAR_SELECTION' })
    setShowBatchDeleteConfirm(false)

    try {
      const response = await fetch('/api/cards/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: board.id, cardIds }),
      })
      if (!response.ok) throw new Error('Failed to batch delete')
      toastSuccess(`已删除 ${cardIds.length} 张卡片`)
      await refreshCurrentBoard()
    } catch {
      toastError('批量删除失败')
      dispatch({ type: 'SET_BOARD', payload: previousBoard })
    }
  }, [board, selectedCardIds, refreshCurrentBoard])

  const handleBatchAddTags = useCallback(async (tags: Tag[]) => {
    const cardIds = Array.from(selectedCardIds)
    if (cardIds.length === 0 || tags.length === 0) return

    try {
      const response = await fetch('/api/cards/batch-update-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: board.id, cardIds, addTags: tags }),
      })
      if (!response.ok) throw new Error('Failed to batch update tags')
      toastSuccess(`已为 ${cardIds.length} 张卡片添加标签`)
      dispatch({ type: 'SET_SHOW_BATCH_TAG_DIALOG', payload: false })
      dispatch({ type: 'CLEAR_SELECTION' })
      await refreshCurrentBoard()
    } catch {
      toastError('批量添加标签失败')
    }
  }, [board.id, selectedCardIds, refreshCurrentBoard])

  // 键盘快捷键
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onFocusQuickAdd: () => {
      const btn = document.querySelector('[data-quick-add-btn]') as HTMLButtonElement | null
      btn?.click()
    },
    onExitSelectionMode: () => dispatch({ type: 'CLEAR_SELECTION' }),
    onCloseDialog: () => {
      if (editingCard) {
        dispatch({ type: 'SET_EDITING_CARD', payload: null })
        return true
      }
      if (showCreateLane) {
        dispatch({ type: 'SET_SHOW_CREATE_LANE', payload: false })
        return true
      }
      if (showChat) {
        dispatch({ type: 'SET_SHOW_CHAT', payload: false })
        return true
      }
      if (showHelp) {
        setShowHelp(false)
        return true
      }
      if (showBatchMoveDialog) {
        dispatch({ type: 'SET_SHOW_BATCH_MOVE_DIALOG', payload: false })
        return true
      }
      if (showBatchTagDialog) {
        dispatch({ type: 'SET_SHOW_BATCH_TAG_DIALOG', payload: false })
        return true
      }
      if (showBatchDeleteConfirm) {
        setShowBatchDeleteConfirm(false)
        return true
      }
      return false
    },
  })

  // 获取正在拖拽的卡片
  const activeCard = activeId && activeType === 'CARD' ? findCardById(board.lanes, activeId) : null
  // 获取正在拖拽的列表
  const activeLane = activeId && activeType === 'LANE' ? board.lanes.find((l) => l.id === activeId) : null

  const totalSelected = selectedCardIds.size

  return (
    <BoardTagsProvider tags={boardTags}>
      <div className="flex h-screen w-full">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 顶部导航栏 */}
          <header className="relative z-50 border-b border-slate-200/60 bg-white/70 px-4 py-3 backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                    <LayoutGrid className="h-4 w-4 text-white" />
                  </div>
                  <ErrorBoundary>
                    <BoardSelector
                      boards={boards}
                      currentBoard={board}
                      onBoardChange={(newBoard) => dispatch({ type: 'SET_BOARD', payload: newBoard })}
                      onBoardsRefresh={refreshBoards}
                    />
                  </ErrorBoundary>
                </div>
              </div>

              {/* 搜索栏 */}
              <div className={cn('flex items-center gap-2', isMobile ? 'w-full' : 'flex-1 max-w-md')}>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="搜索卡片... (Cmd/Ctrl + K)"
                    value={filters.query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        clearFilters()
                        searchInputRef.current?.blur()
                      }
                    }}
                    className="h-9 pl-9 pr-16 bg-slate-100 border-transparent focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {filters.query && (
                    <button
                      onClick={clearFilters}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                      aria-label="清空搜索"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {filters.query && (
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                      {resultCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={selectionMode ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => dispatch({ type: 'TOGGLE_SELECTION_MODE' })}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{selectionMode ? '退出选择' : '选择'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 md:hidden"
                  onClick={() => dispatch({ type: 'SET_SHOW_CHAT', payload: true })}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>AI 助手</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowHelp(true)}
                  aria-label="快捷键帮助"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => dispatch({ type: 'SET_SHOW_CREATE_LANE', payload: true })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">添加列表</span>
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
              <SortableContext
                items={board.lanes.map((l) => l.id)}
                strategy={isMobile ? verticalListSortingStrategy : horizontalListSortingStrategy}
              >
                <div className={cn('flex h-full items-stretch gap-2', isMobile ? 'flex-col' : 'flex-row')}>
                  {filteredBoard.lanes.map((lane) => (
                    <LaneItem
                      key={lane.id}
                      lane={lane}
                      boardId={board.id}
                      isHovered={hoveredLaneId === lane.id}
                      onLaneUpdate={handleLaneUpdate}
                      onCardEdit={handleCardEdit}
                      onLaneDeleted={handleLaneDeleted}
                      selectionMode={selectionMode}
                      selectedCardIds={selectedCardIds}
                      onCardSelectToggle={handleCardSelectToggle}
                      onCardSelectRange={handleCardSelectRange}
                    />
                  ))}

                  {/* 添加列表按钮 */}
                  <button
                    onClick={() => dispatch({ type: 'SET_SHOW_CREATE_LANE', payload: true })}
                    className={cn(
                      'flex shrink-0 flex-col items-center justify-center rounded-2xl',
                      'border-2 border-dashed border-slate-300/60',
                      'bg-slate-50/50 text-slate-500',
                      'transition-all duration-300',
                      'hover:border-primary/60 hover:bg-muted hover:text-primary',
                      'group',
                      isMobile ? 'w-full h-24' : 'h-full w-64'
                    )}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 group-hover:bg-muted transition-colors mb-3">
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
                {activeLane && (
                  <div className="react-kanban-drag-overlay w-64 shrink-0 rotate-1 rounded-lg bg-muted/50 py-3 px-2 shadow-2xl opacity-90">
                    <div className="mb-3 flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <h2 className="font-semibold">{activeLane.title}</h2>
                      <span className="text-xs text-muted-foreground">{activeLane.cards.length}</span>
                    </div>
                    <div className="space-y-2">
                      {activeLane.cards.slice(0, 3).map((card) => (
                        <div key={card.id} className="rounded-md border bg-card p-3 shadow-sm">
                          <h3 className="text-sm font-medium">{card.title}</h3>
                        </div>
                      ))}
                      {activeLane.cards.length > 3 && (
                        <div className="text-center text-xs text-muted-foreground">
                          还有 {activeLane.cards.length - 3} 张卡片...
                        </div>
                      )}
                    </div>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">AI 助手</h2>
                <p className="text-[11px] text-slate-500">DeepSeek 智能助手</p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ErrorBoundary>
                <DeepSeekChatPanel
                  lanes={board.lanes}
                  linkedCard={editingCard}
                  onCardCreated={handleCardCreatedFromChat}
                  onBoardRefresh={refreshCurrentBoard}
                  boardId={board.id}
                  boardTitle={board.title}
                />
              </ErrorBoundary>
            </div>
          </div>
        </aside>

        {/* 移动端聊天对话框 */}
        <Dialog open={showChat} onOpenChange={(open) => dispatch({ type: 'SET_SHOW_CHAT', payload: open })}>
          <DialogContent className="w-[min(92vw,640px)] sm:rounded-2xl overflow-hidden">
            <DialogHeader className="px-4 pt-4 border-b border-slate-200/60">
              <div className="flex items-center gap-2 pb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <DialogTitle className="text-base">AI 助手</DialogTitle>
              </div>
            </DialogHeader>
            <div className="max-h-[80dvh] h-auto">
              <ErrorBoundary>
                <DeepSeekChatPanel
                  lanes={board.lanes}
                  linkedCard={editingCard}
                  onCardCreated={handleCardCreatedFromChat}
                  onBoardRefresh={refreshCurrentBoard}
                  boardId={board.id}
                  boardTitle={board.title}
                />
              </ErrorBoundary>
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

        {/* 快捷键帮助面板 */}
        <KeyboardHelp open={showHelp} onOpenChange={setShowHelp} />

        {/* 批量删除确认对话框 */}
        <ConfirmDialog
          open={showBatchDeleteConfirm}
          onOpenChange={setShowBatchDeleteConfirm}
          title="确认删除"
          description={`确定要删除选中的 ${totalSelected} 张卡片吗？此操作不可撤销。`}
          confirmText="删除"
          cancelText="取消"
          onConfirm={() => void handleBatchDelete()}
        />

        {/* 批量移动对话框 */}
        <Dialog open={showBatchMoveDialog} onOpenChange={(open) => dispatch({ type: 'SET_SHOW_BATCH_MOVE_DIALOG', payload: open })}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">批量移动卡片</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-slate-500 mb-3">选择目标列表，将 {totalSelected} 张卡片移动过去：</p>
              <div className="space-y-2">
                {board.lanes.map((lane) => (
                  <Button
                    key={lane.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => void handleBatchMove(lane.id)}
                  >
                    <Move className="mr-2 h-4 w-4" />
                    {lane.title}
                  </Button>
                ))}
              </div>
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* 批量添加标签对话框 */}
        <Dialog open={showBatchTagDialog} onOpenChange={(open) => dispatch({ type: 'SET_SHOW_BATCH_TAG_DIALOG', payload: open })}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">批量添加标签</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-slate-500 mb-3">为选中的 {totalSelected} 张卡片添加标签：</p>
              <TagSelector
                selectedTags={[]}
                onTagsChange={(tags) => void handleBatchAddTags(tags)}
              />
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* 批量操作栏 */}
        {totalSelected > 0 && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
              <span className="text-sm font-medium text-slate-700 mr-1">
                已选择 {totalSelected} 张卡片
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => dispatch({ type: 'SET_SHOW_BATCH_MOVE_DIALOG', payload: true })}
              >
                <Move className="h-3.5 w-3.5" />
                移动到列表
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => dispatch({ type: 'SET_SHOW_BATCH_TAG_DIALOG', payload: true })}
              >
                <TagIcon className="h-3.5 w-3.5" />
                添加标签
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowBatchDeleteConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
              <div className="h-6 w-px bg-slate-200 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    </BoardTagsProvider>
  )
}
