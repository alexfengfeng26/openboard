'use client'

import { useState, useCallback } from 'react'
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

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'assistant',
      content: guideMessage,
    },
  ])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: createId(),
        role: 'assistant',
        content: guideMessage,
      },
    ])
  }, [])

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
  }
}
