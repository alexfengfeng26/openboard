'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ChatMessage } from '@/types/ai-tools.types'

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const guideMessage =
  'AI 创建卡片超快：\n' +
  '1) 在下方描述需求\n' +
  '2) 等 AI 回复后点「创建为卡片」\n' +
  '3) 需要改标题/描述再点「编辑后创建」\n\n' +
  '示例：帮我生成一个待办卡片：主题"优化拖拽体验"，给出标题和 3 条可执行描述。'

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: createId(),
    role: 'assistant',
    content: guideMessage,
  },
]

export function useChatMessages(boardId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load history on mount
  useEffect(() => {
    if (!boardId || loaded) return

    async function loadHistory() {
      try {
        const response = await fetch(`/api/ai/chat/history?boardId=${encodeURIComponent(boardId)}`)
        if (!response.ok) return
        const result = await response.json()
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          setMessages(result.data)
        }
      } catch {
        // silent fail
      } finally {
        setLoaded(true)
      }
    }

    loadHistory()
  }, [boardId, loaded])

  // Debounced save
  useEffect(() => {
    if (!boardId || !loaded) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      fetch(`/api/ai/chat/history?boardId=${encodeURIComponent(boardId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      }).catch(() => {})
    }, 2000)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [messages, boardId, loaded])

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  }, [])

  const clearMessages = useCallback(async () => {
    setMessages(DEFAULT_MESSAGES)
    if (boardId) {
      try {
        await fetch(`/api/ai/chat/history?boardId=${encodeURIComponent(boardId)}`, {
          method: 'DELETE',
        })
      } catch {
        // silent fail
      }
    }
  }, [boardId])

  const clearHistory = useCallback(async () => {
    await clearMessages()
  }, [clearMessages])

  return {
    messages,
    setMessages,
    input,
    setInput,
    isSending,
    setIsSending,
    addMessage,
    updateMessage,
    clearMessages,
    clearHistory,
  }
}
