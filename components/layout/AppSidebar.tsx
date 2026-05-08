'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Settings,
  Plus,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react'

interface BoardItem {
  id: string
  title: string
  icon?: React.ReactNode
  count?: number
}

interface AppSidebarProps {
  boards?: BoardItem[]
  recentBoards?: BoardItem[]
  activeBoardId?: string
  onBoardSelect?: (boardId: string) => void
  onCreateBoard?: () => void
  onOpenSettings?: () => void
  onToggleAI?: () => void
  aiOpen?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

const STORAGE_KEY = 'kanban-sidebar-expanded'

export function AppSidebar({
  boards,
  recentBoards,
  activeBoardId,
  onBoardSelect,
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

  // 折叠时只渲染一个窄条
  if (!expanded) {
    return (
      <aside
        className="relative flex h-screen flex-col items-center border-r py-4 shrink-0 w-[44px]"
        style={{
          backgroundColor: '#F4EFE7',
          borderColor: '#E2D8CC',
        }}
      >
        {/* Logo */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mb-3"
          style={{ backgroundColor: '#C96442' }}
        >
          <Sparkles className="h-4 w-4 text-white" />
        </div>

        {/* 展开按钮 */}
        <button
          onClick={handleToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[#F0E8DE]"
          style={{ color: '#7B746C' }}
          title="展开菜单"
          aria-label="展开菜单"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* 中间占位 */}
        <div className="flex-1" />

        {/* 底部操作按钮 */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-px" style={{ backgroundColor: '#E2D8CC' }} />
          {/* AI 助手 */}
          <button
            onClick={onToggleAI}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[#F0E8DE]"
            style={{ color: aiOpen ? '#A84F2A' : '#7B746C' }}
            title={aiOpen ? '关闭 AI 助手' : '打开 AI 助手'}
            aria-label={aiOpen ? '关闭 AI 助手' : '打开 AI 助手'}
          >
            {aiOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
          {/* 创建看板 */}
          <button
            onClick={onCreateBoard}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[#F0E8DE]"
            style={{ color: '#7B746C' }}
            title="创建看板"
            aria-label="创建看板"
          >
            <Plus className="h-4 w-4" />
          </button>
          {/* 设置 */}
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[#F0E8DE]"
            style={{ color: '#7B746C' }}
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
        'relative flex h-screen flex-col border-r transition-all duration-300 ease-in-out shrink-0',
        'w-[220px]'
      )}
      style={{
        backgroundColor: '#F4EFE7',
        borderColor: '#E2D8CC',
      }}
    >
      {/* Toggle button on right edge */}
      <button
        onClick={handleToggle}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors hover:bg-white"
        style={{ borderColor: '#E2D8CC', backgroundColor: '#FBFAF7' }}
        aria-label="收起菜单"
      >
        <ChevronLeft className="h-3 w-3" style={{ color: '#7B746C' }} />
      </button>

      {/* Logo & Title */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: '#C96442' }}
        >
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold" style={{ color: '#26211C' }}>
            我的看板
          </h2>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px" style={{ backgroundColor: '#E2D8CC' }} />

      {/* 看板列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider" style={{ color: '#7B746C' }}>
          看板
        </div>
        <nav className="space-y-0.5 px-2">
          {(boards || []).map((board) => (
            <BoardMenuItem
              key={board.id}
              board={board}
              active={board.id === activeBoardId}
              onClick={() => onBoardSelect?.(board.id)}
            />
          ))}
        </nav>

        {/* 最近访问 */}
        {recentBoards && recentBoards.length > 0 && (
          <>
            <div className="mt-4 px-4 py-2 text-[11px] font-medium uppercase tracking-wider" style={{ color: '#7B746C' }}>
              最近访问
            </div>
            <nav className="space-y-0.5 px-2">
              {recentBoards.map((board) => (
                <BoardMenuItem
                  key={board.id}
                  board={board}
                  active={board.id === activeBoardId}
                  onClick={() => onBoardSelect?.(board.id)}
                />
              ))}
            </nav>
          </>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="border-t px-2 py-2" style={{ borderColor: '#E2D8CC' }}>
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
}: {
  board: BoardItem
  active: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
        active
          ? 'font-medium'
          : 'font-normal hover:bg-[#F0E8DE]'
      )}
      style={
        active
          ? {
              backgroundColor: '#EFE3D7',
              color: '#A84F2A',
              borderLeft: '3px solid #C96442',
            }
          : { color: '#26211C' }
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {board.icon || <LayoutDashboard className="h-4 w-4" style={{ color: active ? '#A84F2A' : '#7B746C' }} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{board.title}</span>
      {board.count !== undefined && (
        <span
          className="shrink-0 rounded-full px-1.5 py-0 text-[10px]"
          style={{
            backgroundColor: active ? '#EFE3D7' : '#F0E8DE',
            color: active ? '#A84F2A' : '#7B746C',
          }}
        >
          {board.count}
        </span>
      )}
    </button>
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
        'group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
        active ? 'font-medium' : 'font-normal hover:bg-[#F0E8DE]'
      )}
      style={
        active
          ? {
              backgroundColor: '#EFE3D7',
              color: '#A84F2A',
            }
          : { color: '#26211C' }
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: active ? '#A84F2A' : '#7B746C' }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  )
}
