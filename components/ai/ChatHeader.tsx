'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { AiSettingsDialog } from './AiSettingsDialog'
import type { AiSettings } from '@/types/settings.types'

interface ChatHeaderProps {
  model: 'deepseek-chat' | 'deepseek-reasoner'
  onModelChange: (model: 'deepseek-chat' | 'deepseek-reasoner') => void
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
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 px-4 py-3 bg-white/50">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-5 px-2 text-[10px] rounded-full">
              {model === 'deepseek-reasoner' ? 'Reasoner' : 'Chat'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value as 'deepseek-chat' | 'deepseek-reasoner')}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          aria-label="选择 AI 模型"
        >
          <option value="deepseek-chat">deepseek-chat</option>
          <option value="deepseek-reasoner">deepseek-reasoner</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg"
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
