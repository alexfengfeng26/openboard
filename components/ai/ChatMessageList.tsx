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
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                m.role === 'user'
                  ? 'bg-gradient-to-r bg-primary text-white rounded-br-md'
                  : 'bg-white border border-slate-200/60 text-slate-700 rounded-bl-md'
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
            <div className="max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm bg-white border border-slate-200/60 text-slate-700 rounded-bl-md">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
