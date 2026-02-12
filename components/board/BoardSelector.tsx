'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Plus, Settings2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { toastError } from '@/components/ui/toast'
import type { Board } from '@/lib/db'
import { CreateBoardDialog } from './CreateBoardDialog'
import { EditBoardDialog } from './EditBoardDialog'

interface BoardSelectorProps {
  boards: Array<{ id: string; title: string; createdAt: string; updatedAt: string }>
  currentBoard: Board
  onBoardChange: (board: Board) => void
  onBoardsRefresh: () => void
}

export function BoardSelector({ boards, currentBoard, onBoardChange, onBoardsRefresh }: BoardSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [hoveredBoardId, setHoveredBoardId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const pathname = usePathname()

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 组件挂载时刷新看板列表，确保显示最新数据（只执行一次）
  // 使用 ref 存储 onBoardsRefresh 以避免依赖警告，同时确保只执行一次
  const onBoardsRefreshRef = useRef(onBoardsRefresh)
  onBoardsRefreshRef.current = onBoardsRefresh

  useEffect(() => {
    onBoardsRefreshRef.current()
  }, [])

  // 切换看板
  async function handleBoardSelect(boardId: string) {
    try {
      const response = await fetch(`/api/boards/${boardId}`)
      if (!response.ok) throw new Error('Failed to load board')

      const result = await response.json()
      if (result.success) {
        onBoardChange(result.data)
        setIsOpen(false)
        // 更新 URL 参数
        const url = new URL(window.location.href)
        url.searchParams.set('boardId', boardId)
        router.push(`${pathname}?${url.searchParams.toString()}`)
      }
    } catch (error) {
      toastError('加载看板失败')
    }
  }

  // 获取当前看板的统计信息
  const currentBoardIndex = boards.findIndex((b) => b.id === currentBoard.id)
  const currentBoardInList = currentBoardIndex >= 0 ? boards[currentBoardIndex] : null

  return (
    <>
      <div className="relative z-[100]" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
        >
          <div className="text-left">
            <h1 className="text-lg font-semibold">{currentBoard.title}</h1>
            <p className="text-xs text-muted-foreground">
              {currentBoard.lanes.length} 个列表 · {currentBoard.lanes.reduce((acc, lane) => acc + lane.cards.length, 0)} 个卡片
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-[100] mt-1 w-72 rounded-lg border bg-white shadow-xl">
            <div className="max-h-80 overflow-auto p-1">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className={`group relative flex items-center gap-2 rounded-md px-2 py-2 transition-colors ${
                    board.id === currentBoard.id ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                  onMouseEnter={() => setHoveredBoardId(board.id)}
                  onMouseLeave={() => setHoveredBoardId(null)}
                >
                  <button
                    onClick={() => handleBoardSelect(board.id)}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm font-medium">{board.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {board.id === currentBoard.id
                        ? `${currentBoard.lanes.length} 列 · ${currentBoard.lanes.reduce((acc, l) => acc + l.cards.length, 0)} 卡片`
                        : board.title}
                    </div>
                  </button>

                  {hoveredBoardId === board.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowEdit(true)
                        setIsOpen(false)
                      }}
                      className="rounded p-1 hover:bg-muted-foreground/10"
                      title="编辑看板"
                    >
                      <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}

              <div className="my-1 border-t border-muted-foreground/10" />

              <button
                onClick={() => {
                  setShowCreate(true)
                  setIsOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <Plus className="h-4 w-4" />
                创建新看板
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateBoardDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onBoardCreated={(board) => {
          onBoardsRefresh()
          handleBoardSelect(board.id)
        }}
      />

      {showEdit && (
        <EditBoardDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          board={currentBoard}
          onBoardUpdated={(board) => {
            onBoardChange(board)
            onBoardsRefresh()
          }}
          onBoardDeleted={(boardId) => {
            onBoardsRefresh()
            // 删除后切换到第一个可用看板
            const remainingBoards = boards.filter((b) => b.id !== boardId)
            if (remainingBoards.length > 0) {
              handleBoardSelect(remainingBoards[0].id)
            }
          }}
        />
      )}
    </>
  )
}
