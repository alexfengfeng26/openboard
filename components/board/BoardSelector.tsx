'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Plus, Settings2, Search, LayoutDashboard } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { toastError } from '@/components/ui/toast'
import type { Board as BoardType } from '@/lib/db'
import { CreateBoardDialog } from './CreateBoardDialog'
import { EditBoardDialog } from './EditBoardDialog'
import { cn } from '@/lib/utils'

interface BoardSelectorProps {
  boards: Array<{ id: string; title: string; createdAt: string; updatedAt: string }>
  currentBoard: BoardType
  onBoardChange: (board: BoardType) => void
  onBoardsRefresh: () => void
}

export function BoardSelector({ boards, currentBoard, onBoardChange, onBoardsRefresh }: BoardSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [hoveredBoardId, setHoveredBoardId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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

  // 组件挂载时刷新看板列表
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
        const url = new URL(window.location.href)
        url.searchParams.set('boardId', boardId)
        router.push(`${pathname}?${url.searchParams.toString()}`)
      }
    } catch (error) {
      toastError('加载看板失败')
    }
  }

  // 过滤看板
  const filteredBoards = boards.filter(board =>
    board.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalCards = currentBoard.lanes.reduce((acc, lane) => acc + lane.cards.length, 0)

  return (
    <>
      <div className="relative z-[100]" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'group flex items-center gap-2 rounded-xl px-3 py-2',
            'transition-all duration-200',
            'hover:bg-slate-100/80',
            isOpen && 'bg-slate-100/80'
          )}
        >
          <div className="text-left">
            <h1 className="text-lg font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
              {currentBoard.title}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {currentBoard.lanes.length} 个列表 · {totalCards} 个卡片
            </p>
          </div>
          <ChevronDown 
            className={cn(
              'h-4 w-4 text-slate-400 transition-transform duration-200',
              isOpen && 'rotate-180'
            )} 
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-[100] mt-2 w-80 rounded-2xl border border-slate-200/60 bg-white shadow-xl shadow-slate-900/10 overflow-hidden animate-fade-in">
            {/* 搜索框 */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索看板..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-xl text-sm bg-slate-100 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                />
              </div>
            </div>

            {/* 看板列表 */}
            <div className="max-h-72 overflow-auto p-2">
              {filteredBoards.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <LayoutDashboard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">没有找到看板</p>
                </div>
              ) : (
                filteredBoards.map((board) => (
                  <div
                    key={board.id}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
                      board.id === currentBoard.id 
                        ? 'bg-indigo-50 text-indigo-900' 
                        : 'hover:bg-slate-50'
                    )}
                    onMouseEnter={() => setHoveredBoardId(board.id)}
                    onMouseLeave={() => setHoveredBoardId(null)}
                  >
                    <div 
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                        board.id === currentBoard.id
                          ? 'bg-indigo-100 text-indigo-600'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                    </div>
                    
                    <button
                      onClick={() => handleBoardSelect(board.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className={cn(
                        'text-sm font-semibold truncate',
                        board.id === currentBoard.id ? 'text-indigo-900' : 'text-slate-700'
                      )}>
                        {board.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {board.id === currentBoard.id
                          ? `${currentBoard.lanes.length} 列 · ${totalCards} 卡片`
                          : '点击切换看板'
                        }
                      </div>
                    </button>

                    {hoveredBoardId === board.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowEdit(true)
                          setIsOpen(false)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/80 text-slate-400 hover:text-slate-600 transition-colors"
                        title="编辑看板"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}

              <div className="my-2 border-t border-slate-100" />

              <button
                onClick={() => {
                  setShowCreate(true)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5',
                  'text-slate-600 transition-all duration-200',
                  'hover:bg-indigo-50 hover:text-indigo-700'
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">创建新看板</span>
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
