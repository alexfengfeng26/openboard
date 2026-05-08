'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { AiSettingsDialog } from './AiSettingsDialog'
import type { AiSettings } from '@/types/settings.types'

interface ChatHeaderProps {
  model: 'deepseek-v4-flash' | 'deepseek-v4-pro'
  onModelChange: (model: 'deepseek-v4-flash' | 'deepseek-v4-pro') => void
  showLogPanel: boolean
  onToggleLogPanel: () => void
  operationLogsCount: number
  onClearChat: () => void
  settingsOpen: boolean
  onSettingsOpen: (open: boolean) => void
  aiSettings: AiSettings | null
  settingsLoading: boolean
  onAiSettingsChange: (settings: Partial<AiSettings>) => Promise<void>
}

export function ChatHeader({
  model,
  onModelChange,
  showLogPanel,
  onToggleLogPanel,
  operationLogsCount,
  onClearChat,
  settingsOpen,
  onSettingsOpen,
  aiSettings,
  settingsLoading,
  onAiSettingsChange,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-white px-3 py-2">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">
              {model === 'deepseek-v4-pro' ? 'Pro' : 'Flash'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value as 'deepseek-v4-flash' | 'deepseek-v4-pro')}
          className="h-8 rounded-md border border-border bg-white px-2 text-xs font-medium text-muted-foreground outline-none transition-colors focus:border-ring/40 focus:ring-2 focus:ring-ring/10"
          aria-label="选择 AI 模型"
        >
          <option value="deepseek-v4-flash">V4 Flash</option>
          <option value="deepseek-v4-pro">V4 Pro</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => onSettingsOpen(true)}
          aria-label="AI 设置"
        >
          <Settings className="h-4 w-4" />
        </Button>
        {settingsOpen && (
          <AiSettingsDialog
            open={settingsOpen}
            onOpenChange={onSettingsOpen}
            aiSettings={aiSettings}
            onAiSettingsChange={onAiSettingsChange}
            loading={settingsLoading}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleLogPanel}
          aria-label={showLogPanel ? '隐藏日志' : '查看日志'}
        >
          {showLogPanel ? '隐藏日志' : `日志(${operationLogsCount})`}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearChat}
          aria-label="清空对话"
        >
          清空
        </Button>
      </div>
    </div>
  )
}
