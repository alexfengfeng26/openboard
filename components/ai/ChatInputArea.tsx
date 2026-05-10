'use client'

import { Send, Square, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AiCommand } from '@/types/ai-commands.types'
import type { AiToolTriggerConfig } from '@/types/settings.types'
import { cn } from '@/lib/utils'

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
  onStop?: () => void
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
  onStop,
}: ChatInputAreaProps) {
  return (
    <div className="border-t border-border bg-card">
      {/* 顶部 subtle 渐变分隔 */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="px-3 py-3">
        {/* 快捷模板 */}
        {(!toolTriggerConfig.gateByPrefix || toolTriggerConfig.showQuickTemplatesInChat) && quickbarCommands.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {quickbarCommands.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onApplyTemplate(c.insertText)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border border-border/80 px-2.5 py-1 text-xs',
                  'bg-muted/40 text-muted-foreground transition-all duration-200',
                  'hover:border-primary/30 hover:bg-primary/5 hover:text-foreground hover:-translate-y-0.5 hover:shadow-sm'
                )}
              >
                <Sparkles className="h-3 w-3 text-primary/70" />
                {formatQuickbarLabel(c.label)}
              </button>
            ))}
          </div>
        )}

        {children}

        {/* 输入区域 */}
        <div className="relative flex items-end gap-2">
          <div className="relative flex-1">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={isSending ? 'AI 正在思考…' : '输入你的问题，Enter 发送，Shift+Enter 换行'}
              className={cn(
                'min-h-[80px] resize-none rounded-2xl border-border/80 bg-muted/40 py-3 pl-4 pr-4 text-sm transition-all duration-200',
                'focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:shadow-sm',
                'placeholder:text-muted-foreground/60'
              )}
              onKeyDownCapture={(e) => {
                onInputKeyDownCapture?.(e)
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSend()
                }
              }}
              disabled={isSending}
              rows={3}
            />
          </div>

          {isSending && onStop ? (
            <Button
              onClick={onStop}
              variant="destructive"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl shadow-sm transition-transform duration-200 hover:scale-105 active:scale-95"
              aria-label="停止生成"
              title="停止生成"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={onSend}
              disabled={!input.trim() || isSending}
              size="icon"
              className={cn(
                'h-10 w-10 shrink-0 rounded-xl bg-primary shadow-sm transition-all duration-200',
                'hover:bg-primary/90 hover:scale-105 hover:shadow-md',
                'active:scale-95 disabled:opacity-40 disabled:hover:scale-100'
              )}
              aria-label="发送消息"
              title="发送"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
