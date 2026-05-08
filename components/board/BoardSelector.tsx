'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Plus, Settings2, Search, LayoutDashboard, Download, Upload, Archive } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { toastError, toastSuccess } from '@/components/ui/toast'
import type { Board as BoardType } from '@/lib/db'
import { CreateBoardDialog } from './CreateBoardDialog'
import { EditBoardDialog } from './EditBoardDialog'
import { cn } from '@/lib/utils'

interface BoardSelectorProps {
  boards: Array<{ id: string; title: string; createdAt: string; updatedAt: string; archivedAt?: string }>
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
  const [showArchived, setShowArchived] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

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

  // 导出看板
  async function handleExport(boardId: string, format: 'json' | 'csv' | 'md') {
    try {
      const response = await fetch(`/api/boards/${boardId}/export?format=${format}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `board.${format}`
      a.download = decodeURIComponent(filename)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toastSuccess('导出成功')
    } catch (error) {
      toastError('导出失败')
    }
  }

  // 导入看板
  async function handleImportFile(file: File) {
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const response = await fetch('/api/boards/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Import failed')
      }

      toastSuccess('看板导入成功')
      onBoardsRefresh()
      handleBoardSelect(result.data.id)
    } catch (error) {
      toastError('导入失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 过滤看板
  const displayBoards = boards.filter((board) => {
    if (!showArchived && board.archivedAt) return false
    return board.title.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const totalCards = currentBoard.lanes.reduce((acc, lane) => acc + lane.cards.length, 0)

  return (
    <>
      <div className="relative z-[100]" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'group flex items-center gap-2 rounded-md px-2 py-1.5',
            'transition-colors duration-150',
            'hover:bg-muted',
            isOpen && 'bg-muted'
          )}
        >
          <div className="text-left">
            <h1 className="text-lg font-semibold text-foreground">
              {currentBoard.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {currentBoard.lanes.length} 个列表 · {totalCards} 个卡片
            </p>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-150',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-[100] mt-2 w-80 overflow-hidden rounded-lg border border-border bg-white shadow-lg shadow-black/5 animate-fade-in">
            {/* 搜索框 */}
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="搜索看板..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-md border border-transparent bg-muted pl-8 pr-3 text-sm outline-none transition-colors focus:border-border focus:bg-white focus:ring-2 focus:ring-ring/10"
                  aria-label="搜索看板"
                />
              </div>
            </div>

            {/* 看板列表 */}
            <div className="max-h-72 overflow-auto p-2" role="listbox">
              {displayBoards.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                  <LayoutDashboard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">没有找到看板</p>
                </div>
              ) : (
                displayBoards.map((board) => (
                  <div
                    key={board.id}
                    role="option"
                    aria-selected={board.id === currentBoard.id}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-md px-2 py-2 transition-colors duration-150',
                      board.id === currentBoard.id
                        ? 'bg-muted'
                        : 'hover:bg-muted/60'
                    )}
                    onMouseEnter={() => setHoveredBoardId(board.id)}
                    onMouseLeave={() => setHoveredBoardId(null)}
                  >
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                        board.id === currentBoard.id
                          ? 'bg-background text-foreground'
                          : board.archivedAt
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {board.archivedAt ? (
                        <Archive className="h-4 w-4" />
                      ) : (
                        <LayoutDashboard className="h-4 w-4" />
                      )}
                    </div>

                    <button
                      onClick={() => handleBoardSelect(board.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className={cn(
                        'truncate text-sm font-medium',
                        board.id === currentBoard.id ? 'text-primary' : 'text-foreground'
                      )}>
                        {board.title}
                        {board.archivedAt && (
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">已归档</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {board.id === currentBoard.id
                          ? `${currentBoard.lanes.length} 列 · ${totalCards} 卡片`
                          : '点击切换看板'
                        }
                      </div>
                    </button>

                    {hoveredBoardId === board.id && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExport(board.id, 'json')
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          title="导出看板"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowEdit(true)
                            setIsOpen(false)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          title="编辑看板"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

              <div className="my-2 border-t border-border" />

              <button
                onClick={() => {
                  setShowCreate(true)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2',
                  'text-muted-foreground transition-colors duration-150',
                  'hover:bg-muted'
                )}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">创建新看板</span>
              </button>

              <button
                onClick={() => importInputRef.current?.click()}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2',
                  'text-muted-foreground transition-colors duration-150',
                  'hover:bg-muted'
                )}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                  <Upload className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">导入看板</span>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImportFile(file)
                    e.target.value = ''
                  }}
                />
              </button>
            </div>

            {/* 显示已归档开关 */}
            <div className="border-t border-border bg-muted/40 px-3 py-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground">显示已归档看板</span>
              </label>
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
            const remainingBoards = boards.filter((b) => b.id !== boardId && !b.archivedAt)
            if (remainingBoards.length > 0) {
              handleBoardSelect(remainingBoards[0].id)
            }
          }}
        />
      )}
    </>
  )
}
