'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/types/ai-tools.types'
import { Loader2 } from 'lucide-react'

interface ChatMessageListProps {
  messages: ChatMessage[]
  isSending: boolean
  shouldShowAssistantActions: (messageId: string) => boolean
  onQuickCreate: (message: ChatMessage) => void
  onGenerateDraft: (message: ChatMessage) => void
  draftSubmitting: boolean
  draftSourceId: string | null
}

export function ChatMessageList({
  messages,
  isSending,
  shouldShowAssistantActions,
  onQuickCreate,
  onGenerateDraft,
  draftSubmitting,
  draftSourceId,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  return (
    <div className="flex-1 overflow-y-auto bg-background px-3 py-3">
      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[90%] rounded-lg px-3 py-2.5 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-white text-foreground'
              )}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.role === 'assistant' && shouldShowAssistantActions(m.id) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => onQuickCreate(m)} disabled={draftSubmitting}>
                    {draftSubmitting && draftSourceId === m.id ? '创建中...' : '创建为卡片'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onGenerateDraft(m)} disabled={draftSubmitting}>
                    {draftSubmitting && draftSourceId === m.id ? '生成中...' : '编辑后创建'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isSending && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-lg border border-border bg-white px-3 py-2.5 text-sm leading-relaxed text-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">AI 思考中…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
