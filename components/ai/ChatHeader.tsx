'use client'

import { useState } from 'react'
import { History, Trash2, Zap, Crown, Minus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AiModel } from '@/types/settings.types'
import { cn } from '@/lib/utils'
import { useIconSettings } from '@/lib/hooks/useSettings'
import { AvatarImage } from './AvatarImage'

interface ChatHeaderProps {
  model: AiModel
  onModelChange: (model: AiModel) => void
  showLogPanel: boolean
  onToggleLogPanel: () => void
  operationLogsCount: number
  onClearChat: () => void
  onRequestMinimize?: () => void
  onRequestClose?: () => void
}

export function ChatHeader({
  model,
  onModelChange,
  showLogPanel,
  onToggleLogPanel,
  operationLogsCount,
  onClearChat,
  onRequestMinimize,
  onRequestClose,
}: ChatHeaderProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const { aiAvatar, avatarRevision } = useIconSettings()

  return (
    <div className="pixel-ai-header flex items-center justify-between gap-1.5 border-b border-white/20 bg-white/35 px-2.5 py-1.5 backdrop-blur-xl shadow-sm">
      {/* 左侧：AI 品牌标识 */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-md shadow-sm">
          <AvatarImage
            src={aiAvatar}
            alt="AI"
            cacheKey={avatarRevision}
            className="h-full w-full object-cover"
            fallback={<img src="/logo.svg" alt="AI" className="h-full w-full object-cover" />}
          />
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </div>
        <span className="text-[13px] font-semibold text-foreground">AI 助手</span>
      </div>

      {/* 右侧：模型选择 + 操作按钮 + 窗口控制 */}
      <div className="flex items-center gap-0.5">
        {/* 模型分段控制器 */}
        <div className="mr-1 flex items-center rounded-md bg-muted/80 p-0.5">
          <button
            onClick={() => onModelChange('deepseek-v4-flash')}
            className={cn(
              'flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium transition-all duration-200',
              model === 'deepseek-v4-flash'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="切换到 Flash 模型"
            title="Flash - 快速响应"
          >
            <Zap className="h-3 w-3" />
            Flash
          </button>
          <button
            onClick={() => onModelChange('deepseek-v4-pro')}
            className={cn(
              'flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium transition-all duration-200',
              model === 'deepseek-v4-pro'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="切换到 Pro 模型"
            title="Pro - 深度推理"
          >
            <Crown className="h-3 w-3" />
            Pro
          </button>
        </div>

        {/* 日志按钮 */}
        <Button
          variant={showLogPanel ? 'secondary' : 'ghost'}
          size="icon"
          className={cn(
            'relative h-6 w-6',
            showLogPanel ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={onToggleLogPanel}
          aria-label={showLogPanel ? '隐藏日志' : '查看日志'}
          title={showLogPanel ? '隐藏日志' : `操作日志 (${operationLogsCount})`}
        >
          <History className="h-3.5 w-3.5" />
          {operationLogsCount > 0 && !showLogPanel && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {operationLogsCount > 99 ? '99+' : operationLogsCount}
            </span>
          )}
        </Button>

        {/* 清空按钮 */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => setShowClearConfirm(true)}
            aria-label="清空对话"
            title="清空对话"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {showClearConfirm && (
            <div className="absolute right-0 bottom-full z-50 mb-1.5 flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-white px-2.5 py-1.5 shadow-lg shadow-black/10 animate-menu-pop">
              <span className="text-xs text-destructive font-medium whitespace-nowrap">确定清空?</span>
              <Button
                variant="destructive"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  onClearChat()
                  setShowClearConfirm(false)
                }}
              >
                清空
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </Button>
            </div>
          )}
        </div>

        {/* 分隔线 */}
        <div className="mx-0.5 h-3.5 w-px bg-border" />

        {/* 最小化 */}
        {onRequestMinimize && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onRequestMinimize}
            aria-label="最小化"
            title="最小化"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* 关闭 */}
        {onRequestClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onRequestClose}
            aria-label="关闭"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
