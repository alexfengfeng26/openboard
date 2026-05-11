'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/types/ai-tools.types'
import { useIconSettings } from '@/lib/hooks/useSettings'
import { Copy, Check, Plus, Pencil, User } from 'lucide-react'
import { AvatarImage } from './AvatarImage'

interface ChatMessageListProps {
  messages: ChatMessage[]
  isSending: boolean
  shouldShowAssistantActions: (messageId: string) => boolean
  onQuickCreate: (message: ChatMessage) => void
  onGenerateDraft: (message: ChatMessage) => void
  draftSubmitting: boolean
  draftSourceId: string | null
}

function formatMessageTime(date?: Date): string {
  if (!date) return ''
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isGuideMessage(content: string): boolean {
  return content.includes('AI 创建卡片超快') && content.includes('创建为卡片')
}

function TypingIndicator({ aiAvatar, avatarRevision }: { aiAvatar?: string; avatarRevision?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl shadow-sm overflow-hidden">
        <AvatarImage
          src={aiAvatar}
          alt="AI"
          cacheKey={avatarRevision}
          className="h-full w-full object-cover"
          fallback={<img src="/logo.svg" alt="AI" className="h-full w-full object-cover" />}
        />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-white px-4 py-3 shadow-sm">
        <span
          className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50 animate-typing-dot"
        />
        <span
          className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50 animate-typing-dot-delay-1"
        />
        <span
          className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50 animate-typing-dot-delay-2"
        />
      </div>
    </div>
  )
}

function FloatingUserAvatar({
  userAvatar,
  avatarRevision,
}: {
  userAvatar?: string
  avatarRevision?: number
}) {
  if (!userAvatar) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute right-3 top-3 z-20',
        'flex items-end gap-2'
      )}
      aria-hidden="true"
    >
      <div className="relative flex h-9 w-9 animate-avatar-float items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-2 ring-background md:h-10 md:w-10">
        <span className="animate-pulse-ring absolute inset-0 rounded-2xl border border-primary/35" />
        <AvatarImage
          src={userAvatar}
          alt="A 角色头像"
          cacheKey={avatarRevision}
          className="h-full w-full object-cover"
          fallback={<User className="h-4 w-4 text-muted-foreground" />}
        />
        <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-border/70 bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground shadow-sm">
          A
        </span>
      </div>
    </div>
  )
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
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { userAvatar, aiAvatar, avatarRevision } = useIconSettings()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const handleCopy = useCallback(async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="claude-ai-message-list relative flex-1 overflow-hidden bg-background">
      <div className="h-full overflow-y-auto pl-3 pr-14 py-4 pb-20 md:pr-16">
        <div className="space-y-4">
          {messages.map((m, index) => {
          const isUser = m.role === 'user'
          const isAssistant = m.role === 'assistant'
          const showActions = isAssistant && shouldShowAssistantActions(m.id)
          const isGuide = isAssistant && isGuideMessage(m.content)
          const isFirstInGroup = index === 0 || messages[index - 1].role !== m.role
          const isLastInGroup = index === messages.length - 1 || messages[index + 1].role !== m.role

          if (isGuide) {
            return (
              <section key={m.id} className="claude-ai-guide-card animate-message-in">
                <div className="claude-ai-card-title">任务执行模拟 · 任务指挥中心</div>
                <div className="claude-ai-guide-content whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {m.content}
                </div>
                {showActions && (
                  <div className="claude-ai-card-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={() => onQuickCreate(m)}
                      disabled={draftSubmitting}
                    >
                      {draftSubmitting && draftSourceId === m.id ? (
                        <>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          创建中...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          创建为卡片
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={() => onGenerateDraft(m)}
                      disabled={draftSubmitting}
                    >
                      {draftSubmitting && draftSourceId === m.id ? (
                        <>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Pencil className="h-3.5 w-3.5" />
                          编辑后创建
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </section>
            )
          }

          return (
            <div
              key={m.id}
              className={cn(
                'claude-ai-message-row flex animate-message-in gap-2.5',
                isUser ? 'justify-end' : 'justify-start'
              )}
            >
              {/* AI 头像 */}
              {!isUser && isFirstInGroup && (
                <div className="claude-ai-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm overflow-hidden self-end mb-1">
                  <AvatarImage
                    src={aiAvatar}
                    alt="AI"
                    cacheKey={avatarRevision}
                    className="h-full w-full object-cover"
                    fallback={<img src="/logo.svg" alt="AI" className="h-full w-full object-cover" />}
                  />
                </div>
              )}
              {!isUser && !isFirstInGroup && <div className="w-8 shrink-0" />}

              {/* 消息内容区域 */}
              <div className={cn('group flex max-w-[85%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
                {/* 消息气泡 */}
                <div
                  className={cn(
                    'claude-ai-bubble relative',
                    isUser
                      ? 'rounded-2xl rounded-tr-sm bg-gradient-to-br from-primary to-primary/85 px-4 py-2.5 text-primary-foreground shadow-sm'
                      : isGuide
                        ? 'rounded-2xl rounded-tl-sm border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-orange-50/60 px-4 py-3 shadow-sm'
                        : 'rounded-2xl rounded-tl-sm border border-border bg-white px-4 py-2.5 shadow-sm'
                  )}
                >
                  {/* 复制按钮（仅 AI 消息） */}
                  {isAssistant && (
                    <button
                      onClick={() => handleCopy(m.content, m.id)}
                      className={cn(
                        'absolute -right-1 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white shadow-sm transition-all duration-200',
                        'opacity-0 group-hover:opacity-100 hover:bg-muted hover:scale-110',
                        copiedId === m.id && 'opacity-100 bg-emerald-50 border-emerald-200'
                      )}
                      title={copiedId === m.id ? '已复制' : '复制内容'}
                    >
                      {copiedId === m.id ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  )}

                  {/* 消息内容 */}
                  <div
                    className={cn(
                      'whitespace-pre-wrap text-sm leading-relaxed',
                      isUser ? 'text-primary-foreground' : 'text-foreground'
                    )}
                  >
                    {m.content}
                  </div>

                  {/* 操作按钮 */}
                  {showActions && (
                    <div className="mt-2.5 flex items-center gap-1 border-t border-border/60 pt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                        onClick={() => onQuickCreate(m)}
                        disabled={draftSubmitting}
                      >
                        {draftSubmitting && draftSourceId === m.id ? (
                          <>
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            创建中...
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            创建为卡片
                          </>
                        )}
                      </Button>
                      <div className="h-3.5 w-px bg-border" />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                        onClick={() => onGenerateDraft(m)}
                        disabled={draftSubmitting}
                      >
                        {draftSubmitting && draftSourceId === m.id ? (
                          <>
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Pencil className="h-3.5 w-3.5" />
                            编辑后创建
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* 时间戳 */}
                {isLastInGroup && (
                  <span className="px-1 text-[10px] text-muted-foreground/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100 will-change-opacity">
                    {formatMessageTime(new Date())}
                  </span>
                )}
              </div>

              {/* 用户头像 */}
              {isUser && isFirstInGroup && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm overflow-hidden self-end mb-1">
                  <AvatarImage
                    src={userAvatar}
                    alt="User"
                    cacheKey={avatarRevision}
                    className="h-full w-full object-cover"
                    fallback={<User className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>
              )}
              {isUser && !isFirstInGroup && <div className="w-8 shrink-0" />}
            </div>
          )
          })}

          {/* Loading 状态 */}
          {isSending && messages[messages.length - 1]?.role === 'user' && (
            <TypingIndicator aiAvatar={aiAvatar} avatarRevision={avatarRevision} />
          )}

          <div ref={bottomRef} />
        </div>
      </div>
      <FloatingUserAvatar userAvatar={userAvatar} avatarRevision={avatarRevision} />
    </div>
  )
}
