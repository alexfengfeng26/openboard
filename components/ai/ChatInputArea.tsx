'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AiCommand } from '@/types/ai-commands.types'
import type { AiToolTriggerConfig } from '@/types/settings.types'

interface ChatInputAreaProps {
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  isSending: boolean
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  children?: React.ReactNode
  quickbarCommands: AiCommand[]
  toolTriggerConfig: AiToolTriggerConfig
  onApplyTemplate: (text: string) => void
  onInputKeyDownCapture?: (e: React.KeyboardEvent) => void
}

function formatQuickbarLabel(label: string) {
  return label.replace(/^\/模板[:：]\s*/, '')
}

export function ChatInputArea({
  input,
  onInputChange,
  onSend,
  isSending,
  inputRef,
  children,
  quickbarCommands,
  toolTriggerConfig,
  onApplyTemplate,
  onInputKeyDownCapture,
}: ChatInputAreaProps) {
  return (
    <div className="border-t border-slate-200/60 bg-white/50 px-4 py-3">
      {(!toolTriggerConfig.gateByPrefix || toolTriggerConfig.showQuickTemplatesInChat) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {quickbarCommands.map((c) => (
            <Button
              key={c.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onApplyTemplate(c.insertText)}
              className="rounded-full text-xs"
            >
              {formatQuickbarLabel(c.label)}
            </Button>
          ))}
        </div>
      )}
      {children}
      <div className="relative flex items-end gap-2">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="输入你的问题…（Enter 发送，Shift+Enter 换行）"
          className="min-h-[52px] resize-none text-sm bg-white rounded-xl border-slate-200 focus:border-primary"
          onKeyDownCapture={(e) => {
            onInputKeyDownCapture?.(e)
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          disabled={isSending}
        />
        <Button
          onClick={onSend}
          disabled={!input.trim() || isSending}
          className="h-[52px] px-6 rounded-xl"
          aria-label="发送消息"
        >
          {isSending ? '发送中…' : '发送'}
        </Button>
      </div>
    </div>
  )
}
