'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  Plus,
  PanelRightOpen,
  PanelRightClose,
  Pencil,
  Archive,
  Star,
  ArchiveRestore,
} from 'lucide-react'

export interface BoardItem {
  id: string
  title: string
  icon?: string
  count?: number
  archivedAt?: string
  favoritedAt?: string
}

export interface AppSidebarProps {
  boards?: BoardItem[]
  recentBoards?: BoardItem[]
  activeBoardId?: string
  onBoardSelect?: (boardId: string) => void
  onBoardEdit?: (boardId: string) => void
  onBoardArchive?: (boardId: string) => void
  onBoardFavorite?: (boardId: string, favorited: boolean) => void
  onCreateBoard?: () => void
  onOpenSettings?: () => void
  onToggleAI?: () => void
  aiOpen?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

const STORAGE_KEY = 'kanban-sidebar-expanded'
const SHOW_ARCHIVED_KEY = 'kanban-sidebar-show-archived'
const SHOW_BOARDS_KEY = 'kanban-sidebar-show-boards'

export function AppSidebar({
  boards,
  recentBoards,
  activeBoardId,
  onBoardSelect,
  onBoardEdit,
  onBoardArchive,
  onBoardFavorite,
  onCreateBoard,
  onOpenSettings,
  onToggleAI,
  aiOpen,
  expanded: controlledExpanded,
  onExpandedChange,
}: AppSidebarProps) {
  const [internalExpanded, setInternalExpanded] = useState(true)
  const isControlled = controlledExpanded !== undefined
  const expanded = isControlled ? controlledExpanded : internalExpanded

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null && !isControlled) {
      setInternalExpanded(saved === 'true')
    }
  }, [isControlled])

  const handleToggle = () => {
    const next = !expanded
    if (!isControlled) {
      setInternalExpanded(next)
      localStorage.setItem(STORAGE_KEY, String(next))
    }
    onExpandedChange?.(next)
  }

  // 对看板排序：收藏的置顶，然后按标题排序
  const sortedBoards = React.useMemo(() => {
    const list = [...(boards || [])]
    list.sort((a, b) => {
      const aFav = a.favoritedAt ? 1 : 0
      const bFav = b.favoritedAt ? 1 : 0
      if (aFav !== bFav) return bFav - aFav
      return a.title.localeCompare(b.title, 'zh-CN')
    })
    return list
  }, [boards])

  // 分离活跃和已归档看板
  const activeBoards = sortedBoards.filter((b) => !b.archivedAt)
  const archivedBoards = sortedBoards.filter((b) => b.archivedAt)

  // 未归档看板展开状态（默认展开）
  const [showBoards, setShowBoards] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem(SHOW_BOARDS_KEY)
    return saved === null ? true : saved === 'true'
  })

  const toggleBoards = () => {
    const next = !showBoards
    setShowBoards(next)
    localStorage.setItem(SHOW_BOARDS_KEY, String(next))
  }

  // 已归档看板展开状态
  const [showArchived, setShowArchived] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SHOW_ARCHIVED_KEY) === 'true'
  })

  const toggleArchived = () => {
    const next = !showArchived
    setShowArchived(next)
    localStorage.setItem(SHOW_ARCHIVED_KEY, String(next))
  }

  // 折叠时只渲染一个窄条
  if (!expanded) {
    return (
      <aside
        className="pixel-sidebar relative flex h-screen flex-col items-center border-r border-sidebar-border py-3 shrink-0 w-[40px] bg-sidebar"
      >
        {/* Logo */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mb-3 bg-primary">
          <Sparkles className="h-4 w-4 text-white" />
        </div>

        {/* 展开按钮 */}
        <button
          onClick={handleToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent text-sidebar-foreground/60"
          title="展开菜单"
          aria-label="展开菜单"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* 中间占位 */}
        <div className="flex-1" />

        {/* 底部操作按钮 */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-px bg-sidebar-border" />
          {/* AI 助手 */}
          <button
            onClick={onToggleAI}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent',
              aiOpen ? 'text-primary' : 'text-sidebar-foreground/60'
            )}
            title={aiOpen ? '关闭 AI 助手' : '打开 AI 助手'}
            aria-label={aiOpen ? '关闭 AI 助手' : '打开 AI 助手'}
          >
            {aiOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
          {/* 创建看板 */}
          <button
            onClick={onCreateBoard}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent text-sidebar-foreground/60"
            title="创建看板"
            aria-label="创建看板"
          >
            <Plus className="h-4 w-4" />
          </button>
          {/* 设置 */}
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent text-sidebar-foreground/60"
            title="设置"
            aria-label="设置"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        'pixel-sidebar relative flex h-screen flex-col overflow-hidden border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0',
        'w-[196px] bg-sidebar'
      )}
    >
      {/* Toggle button on right edge */}
      <button
        onClick={handleToggle}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-background shadow-sm transition-colors hover:bg-card"
        aria-label="收起菜单"
      >
        <ChevronLeft className="h-3 w-3 text-sidebar-foreground/60" />
      </button>

      {/* Logo & Title */}
      <div className="flex items-center gap-2.5 px-3 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/90">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-sidebar-foreground">
            我的看板
          </h2>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-2.5 h-px bg-sidebar-border" />

      {/* 看板列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        <button
          onClick={toggleBoards}
          className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors text-sidebar-foreground/60 hover:text-primary"
        >
          <span>看板</span>
          <span className="flex items-center gap-1">
            <span className="rounded-full px-1.5 py-0 text-[10px] bg-sidebar-accent text-sidebar-foreground/60">
              {activeBoards.length}
            </span>
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', showBoards && 'rotate-180')}
            />
          </span>
        </button>
        {showBoards && (
          <nav className="space-y-0.5 px-1.5">
            {activeBoards.map((board) => (
              <BoardMenuItem
                key={board.id}
                board={board}
                active={board.id === activeBoardId}
                onClick={() => onBoardSelect?.(board.id)}
                onEdit={() => onBoardEdit?.(board.id)}
                onArchive={() => onBoardArchive?.(board.id)}
                onFavorite={() => onBoardFavorite?.(board.id, !board.favoritedAt)}
              />
            ))}
          </nav>
        )}

        {/* 已归档看板 — 可折叠 */}
        {archivedBoards.length > 0 && (
          <div className="mt-2">
            <button
              onClick={toggleArchived}
              className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors text-sidebar-foreground/60 hover:text-primary"
            >
              <span>已归档</span>
              <span className="flex items-center gap-1">
                <span className="rounded-full px-1.5 py-0 text-[10px] bg-sidebar-accent text-sidebar-foreground/60">
                  {archivedBoards.length}
                </span>
                <ChevronDown
                  className={cn('h-3 w-3 transition-transform', showArchived && 'rotate-180')}
                />
              </span>
            </button>
            {showArchived && (
              <nav className="space-y-0.5 px-1.5">
                {archivedBoards.map((board) => (
                  <BoardMenuItem
                    key={board.id}
                    board={board}
                    active={board.id === activeBoardId}
                    onClick={() => onBoardSelect?.(board.id)}
                    onEdit={() => onBoardEdit?.(board.id)}
                    onArchive={() => onBoardArchive?.(board.id)}
                    onFavorite={() => onBoardFavorite?.(board.id, !board.favoritedAt)}
                  />
                ))}
              </nav>
            )}
          </div>
        )}

        {/* 最近访问 — 过滤掉已归档的 */}
        {recentBoards && recentBoards.filter((b) => !b.archivedAt).length > 0 && (
          <>
            <div className="mt-4 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/60">
              最近访问
            </div>
            <nav className="space-y-0.5 px-1.5">
              {recentBoards.filter((b) => !b.archivedAt).map((board) => (
                <BoardMenuItem
                  key={board.id}
                  board={board}
                  active={board.id === activeBoardId}
                  onClick={() => onBoardSelect?.(board.id)}
                  onEdit={() => onBoardEdit?.(board.id)}
                  onArchive={() => onBoardArchive?.(board.id)}
                  onFavorite={() => onBoardFavorite?.(board.id, !board.favoritedAt)}
                />
              ))}
            </nav>
          </>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-sidebar-border px-1.5 py-1.5">
        <nav className="space-y-0.5">
          {/* AI 助手 */}
          <SidebarActionButton
            icon={aiOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            label={aiOpen ? '关闭 AI 助手' : '打开 AI 助手'}
            active={aiOpen}
            onClick={onToggleAI}
          />
          {/* 创建看板 */}
          <SidebarActionButton
            icon={<Plus className="h-4 w-4" />}
            label="创建看板"
            onClick={onCreateBoard}
          />
          {/* 设置 */}
          <SidebarActionButton
            icon={<Settings className="h-4 w-4" />}
            label="设置"
            onClick={onOpenSettings}
          />
        </nav>
      </div>
    </aside>
  )
}

function BoardMenuItem({
  board,
  active,
  onClick,
  onEdit,
  onArchive,
  onFavorite,
}: {
  board: BoardItem
  active: boolean
  onClick?: () => void
  onEdit?: () => void
  onArchive?: () => void
  onFavorite?: () => void
}) {
  const isArchived = !!board.archivedAt
  const isFavorited = !!board.favoritedAt

  return (
    <div
      className={cn(
        'group relative flex w-full items-center rounded-md text-sm transition-all duration-150 hover:scale-[1.01]',
        active
          ? 'font-medium'
          : 'font-normal hover:bg-sidebar-accent'
      )}
      style={
        active
          ? {
              backgroundColor: 'hsl(var(--primary) / 0.1)',
              color: 'hsl(var(--primary))',
              borderLeft: '3px solid hsl(var(--primary))',
            }
          : { color: 'hsl(var(--sidebar-foreground))' }
      }
    >
      {/* 主按钮区域 */}
      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-3 px-2.5 py-2 min-w-0"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          {isFavorited ? (
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          ) : board.icon ? (
            <img src={board.icon} alt="" className="h-4 w-4 object-contain" />
          ) : (
            <LayoutDashboard className={cn("h-4 w-4", active ? "text-primary" : "text-sidebar-foreground/60")} />
          )}
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-left", isArchived && "line-through opacity-50")}>
          {board.title}
        </span>
        {board.count !== undefined && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0 text-[10px]"
            style={{
              backgroundColor: active ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--sidebar-accent))',
              color: active ? 'hsl(var(--primary))' : 'hsl(var(--sidebar-foreground) / 0.6)',
            }}
          >
            {board.count}
          </span>
        )}
      </button>

      {/* 操作按钮 — hover 时显示 */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* 收藏 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onFavorite?.()
          }}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-black/5"
          title={isFavorited ? '取消收藏' : '收藏'}
          aria-label={isFavorited ? '取消收藏' : '收藏'}
        >
          <Star
            className={cn("h-3.5 w-3.5", isFavorited ? "fill-amber-400 text-amber-400" : "text-sidebar-foreground/60")}
          />
        </button>
        {/* 编辑 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit?.()
          }}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-black/5"
          title="编辑看板"
          aria-label="编辑看板"
        >
          <Pencil className="h-3.5 w-3.5 text-sidebar-foreground/60" />
        </button>
        {/* 归档/恢复 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onArchive?.()
          }}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-black/5"
          title={isArchived ? '恢复看板' : '归档看板'}
          aria-label={isArchived ? '恢复看板' : '归档看板'}
        >
          {isArchived ? (
            <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Archive className="h-3.5 w-3.5 text-sidebar-foreground/60" />
          )}
        </button>
      </div>
    </div>
  )
}

function SidebarActionButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-all duration-150 hover:scale-[1.01]',
        active ? 'font-medium' : 'font-normal hover:bg-sidebar-accent'
      )}
      style={
        active
          ? {
              backgroundColor: 'hsl(var(--primary) / 0.1)',
              color: 'hsl(var(--primary))',
            }
          : { color: 'hsl(var(--sidebar-foreground))' }
      }
    >
      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center", active ? "text-primary" : "text-sidebar-foreground/60")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  )
}
