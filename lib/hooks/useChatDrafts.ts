'use client'

import { useState, useCallback } from 'react'
import type { CardDraft } from '@/lib/ai-tools/parser/card-draft-types'
import type { Card } from '@/lib/db'
import type { ChatMessage, OperationLogEntry, PromptContext } from '@/types/ai-tools.types'
import { parseCardDraftItemsFromAiContent } from '@/lib/ai/card-draft-parser'
import { PromptBuilder } from '@/lib/ai-tools'
import { toastError, toastInfo, toastSuccess, toastWarning } from '@/components/ui/toast'

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type DraftParseResult =
  | { ok: true; drafts: CardDraft[]; raw: string; repairedRaw?: string }
  | { ok: false; error: string; raw: string; repairedRaw?: string }

async function callChatApi(payload: unknown): Promise<string> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'AI 请求失败')
  if (typeof data?.content !== 'string') throw new Error('AI 返回格式异常')
  return data.content
}

export interface UseChatDraftsOptions {
  boardId?: string
  defaultLaneId: string
  linkedCard: Card | null
  onCardCreated: (laneId: string, card: Card) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setOperationLogs: React.Dispatch<React.SetStateAction<OperationLogEntry[]>>
}

export interface UseChatDraftsReturn {
  draft: CardDraft | null
  draftQueue: CardDraft[] | null
  draftIndex: number
  draftError: string | null
  draftRaw: string | null
  draftRepairedRaw: string | null
  draftSubmitting: boolean
  draftSourceId: string | null
  closeDraftPanel: () => void
  openDraftQueue: (drafts: CardDraft[]) => void
  setDraft: React.Dispatch<React.SetStateAction<CardDraft | null>>
  setDraftError: React.Dispatch<React.SetStateAction<string | null>>
  setDraftRaw: React.Dispatch<React.SetStateAction<string | null>>
  setDraftRepairedRaw: React.Dispatch<React.SetStateAction<string | null>>
  setDraftSubmitting: React.Dispatch<React.SetStateAction<boolean>>
  setDraftSourceId: React.Dispatch<React.SetStateAction<string | null>>
  setDraftQueue: React.Dispatch<React.SetStateAction<CardDraft[] | null>>
  setDraftIndex: React.Dispatch<React.SetStateAction<number>>
  handleCreateCurrentCard: () => Promise<void>
  handleCreateAllCards: () => Promise<void>
  handleGenerateDraft: (source: ChatMessage, model: string, buildSystemContext: () => PromptContext) => Promise<void>
  handleQuickCreate: (source: ChatMessage, model: string, buildSystemContext: () => PromptContext) => Promise<void>
  handleDraftsFromSend: (drafts: CardDraft[]) => Promise<void>
  copyToClipboard: (text: string) => Promise<void>
}

export function useChatDrafts(options: UseChatDraftsOptions): UseChatDraftsReturn {
  const { boardId, defaultLaneId, linkedCard, onCardCreated, setMessages, setOperationLogs } = options

  const [draft, setDraft] = useState<CardDraft | null>(null)
  const [draftQueue, setDraftQueue] = useState<CardDraft[] | null>(null)
  const [draftIndex, setDraftIndex] = useState(0)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftRaw, setDraftRaw] = useState<string | null>(null)
  const [draftRepairedRaw, setDraftRepairedRaw] = useState<string | null>(null)
  const [draftSubmitting, setDraftSubmitting] = useState(false)
  const [draftSourceId, setDraftSourceId] = useState<string | null>(null)

  const closeDraftPanel = useCallback(() => {
    setDraft(null)
    setDraftQueue(null)
    setDraftIndex(0)
    setDraftRaw(null)
    setDraftRepairedRaw(null)
  }, [])

  const openDraftQueue = useCallback((drafts: CardDraft[]) => {
    setDraftQueue(drafts)
    setDraftIndex(0)
    setDraft(drafts[0] || null)
  }, [])

  const createCardFromDraft = useCallback(async (nextDraft: CardDraft) => {
    const logId = createId()
    const timestamp = new Date().toISOString()
    const params: Record<string, unknown> = {
      boardId,
      laneId: nextDraft.laneId,
      title: nextDraft.title.trim(),
      description: nextDraft.description?.trim() || undefined,
    }
    setOperationLogs((prev) => [
      { id: logId, timestamp, status: 'confirmed', confirmedBy: 'user', toolName: 'create_card', params },
      ...prev,
    ])
    const response = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.success) {
      const message = typeof data?.error === 'string' ? data.error : '创建卡片失败'
      setOperationLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: 'failed', error: message, timestamp: new Date().toISOString() } : l))
      )
      throw new Error(message)
    }
    setOperationLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, status: 'executed', result: data.data, timestamp: new Date().toISOString() } : l))
    )
    onCardCreated(nextDraft.laneId, data.data as Card)
  }, [boardId, onCardCreated, setOperationLogs])

  const createCardsFromDrafts = useCallback(async (drafts: CardDraft[]) => {
    const results: { success: boolean; title: string; error?: string }[] = []
    for (const d of drafts) {
      if (!d.title.trim()) continue
      try {
        await createCardFromDraft(d)
        results.push({ success: true, title: d.title })
      } catch (error) {
        results.push({ success: false, title: d.title, error: error instanceof Error ? error.message : String(error) })
      }
    }
    return {
      results,
      successCount: results.filter((r) => r.success).length,
      failCount: results.filter((r) => !r.success).length,
    }
  }, [createCardFromDraft])

  const itemsToDrafts = useCallback((items: Array<{ title: string; description?: string }>) => {
    if (!defaultLaneId) throw new Error('缺少目标列表')
    const drafts = items
      .map((i) => ({ laneId: defaultLaneId, title: i.title, description: i.description || undefined }))
      .filter((d) => d.title.trim().length > 0)
    if (drafts.length === 0) throw new Error('未能从 AI 结果中解析 title')
    return drafts
  }, [defaultLaneId])

  const generateDraftsFromText = useCallback(
    async (text: string, model: string, buildSystemContext: () => PromptContext): Promise<DraftParseResult> => {
      const wantsMultiCard = ['拆分', '拆成', '多张', '多个', '子任务', '3-5张', '2-3张', '5张'].some((k) => text.includes(k))
      const prompt = [
        '请把下面内容整理为"看板卡片草稿"。',
        wantsMultiCard ? '需要生成多张卡片（3-5张），每张卡片包含独立的标题和描述。' : '生成一张卡片，包含标题和描述。',
        '只输出 JSON 数组，不要输出任何解释文字、代码块标记或其他内容。',
        '格式示例：[{"title":"第一张卡片标题","description":"详细描述"},{"title":"第二张卡片标题","description":"详细描述"}]',
        linkedCard ? `关联卡片上下文：${linkedCard.title}` : '',
        '内容：',
        text,
      ]
        .filter(Boolean)
        .join('\n')

      const content = await callChatApi({
        model,
        system: PromptBuilder.buildChatSystemPrompt(buildSystemContext()),
        messages: [{ role: 'user', content: prompt }],
      })

      try {
        return { ok: true, drafts: itemsToDrafts(parseCardDraftItemsFromAiContent(content)), raw: content }
      } catch {
        try {
          const repairPrompt = [
            '把下面文本转换为看板卡片草稿 JSON 数组。',
            wantsMultiCard ? '需要生成多张卡片（3-5张），每张卡片包含独立的标题和描述。' : '生成一张卡片，包含标题和描述。',
            '只输出严格合法的 JSON 数组：必须使用双引号，禁止代码块标记，禁止解释文字，禁止 markdown 表格。',
            '格式示例：[{"title":"卡片标题","description":"描述"}]',
            '待转换文本：',
            content,
          ].join('\n')
          const repaired = await callChatApi({
            model,
            system: PromptBuilder.buildChatSystemPrompt(buildSystemContext()),
            messages: [{ role: 'user', content: repairPrompt }],
          })
          return { ok: true, drafts: itemsToDrafts(parseCardDraftItemsFromAiContent(repaired)), raw: content, repairedRaw: repaired }
        } catch (e2) {
          return { ok: false, error: `未能从 AI 结果中解析卡片：${e2 instanceof Error ? e2.message : String(e2)}`, raw: content }
        }
      }
    },
    [linkedCard, itemsToDrafts]
  )

  const handleCreateCurrentCard = useCallback(async () => {
    if (!draft || !draft.title.trim() || !draft.laneId || draftSubmitting) return
    setDraftSubmitting(true)
    setDraftError(null)
    try {
      await createCardFromDraft(draft)
      if (draftQueue && draftQueue.length > 1) {
        const nextQueue = draftQueue.filter((_, i) => i !== draftIndex)
        if (nextQueue.length === 0) {
          closeDraftPanel()
        } else {
          const nextIndex = Math.min(draftIndex, nextQueue.length - 1)
          setDraftQueue(nextQueue)
          setDraftIndex(nextIndex)
          setDraft(nextQueue[nextIndex])
        }
      } else {
        closeDraftPanel()
      }
      setDraftSourceId(null)
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setDraftSubmitting(false)
    }
  }, [draft, draftQueue, draftIndex, draftSubmitting, createCardFromDraft, closeDraftPanel])

  const handleCreateAllCards = useCallback(async () => {
    const list = draftQueue && draftQueue.length > 0 ? draftQueue : draft ? [draft] : []
    const drafts = list.filter((d) => d.title.trim())
    if (draftSubmitting || drafts.length === 0) return
    setDraftSubmitting(true)
    setDraftError(null)
    try {
      const { successCount, failCount } = await createCardsFromDrafts(drafts)
      if (failCount === 0) toastSuccess(`已创建 ${successCount} 张卡片`)
      else if (successCount > 0) toastWarning(`已创建 ${successCount} 张，失败 ${failCount} 张`)
      else toastError(`创建失败：${failCount} 张`)
      closeDraftPanel()
      setDraftSourceId(null)
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setDraftSubmitting(false)
    }
  }, [draft, draftQueue, draftSubmitting, createCardsFromDrafts, closeDraftPanel])

  const handleGenerateDraft = useCallback(
    async (source: ChatMessage, model: string, buildSystemContext: () => PromptContext) => {
      if (draftSubmitting) return
      closeDraftPanel()
      setDraftError(null)
      setDraftSourceId(source.id)
      setDraftRaw(null)
      setDraftRepairedRaw(null)
      setDraftSubmitting(true)
      try {
        const result = await generateDraftsFromText(source.content, model, buildSystemContext)
        setDraftRaw(result.raw)
        setDraftRepairedRaw(result.repairedRaw ?? null)
        if (result.ok) {
          openDraftQueue(result.drafts)
          if (result.drafts.length > 1) toastInfo(`已生成 ${result.drafts.length} 张卡片草稿`)
        } else {
          setDraftError((result as DraftParseResult & { ok: false; error: string }).error)
          openDraftQueue([{ laneId: defaultLaneId, title: '', description: source.content }])
        }
      } finally {
        setDraftSubmitting(false)
      }
    },
    [draftSubmitting, closeDraftPanel, defaultLaneId, generateDraftsFromText, openDraftQueue]
  )

  const handleQuickCreate = useCallback(
    async (source: ChatMessage, model: string, buildSystemContext: () => PromptContext) => {
      if (draftSubmitting) return
      closeDraftPanel()
      setDraftError(null)
      setDraftSourceId(source.id)
      setDraftRaw(null)
      setDraftRepairedRaw(null)
      setDraftSubmitting(true)
      try {
        const result = await generateDraftsFromText(source.content, model, buildSystemContext)
        setDraftRaw(result.raw)
        setDraftRepairedRaw(result.repairedRaw ?? null)
        if (!result.ok) throw new Error((result as DraftParseResult & { ok: false; error: string }).error)
        const { successCount, failCount } = await createCardsFromDrafts(result.drafts)
        if (failCount === 0) toastSuccess(`已创建 ${successCount} 张卡片`)
        else if (successCount > 0) toastWarning(`已创建 ${successCount} 张，失败 ${failCount} 张`)
        else toastError(`创建失败：${failCount} 张`)
        setDraftSourceId(null)
      } catch (e) {
        setDraftError(e instanceof Error ? e.message : '创建失败')
        openDraftQueue([{ laneId: defaultLaneId, title: '', description: source.content }])
      } finally {
        setDraftSubmitting(false)
      }
    },
    [draftSubmitting, closeDraftPanel, defaultLaneId, generateDraftsFromText, createCardsFromDrafts, openDraftQueue]
  )

  const handleDraftsFromSend = useCallback(
    async (drafts: CardDraft[]) => {
      if (drafts.length === 1) {
        setDraft(drafts[0])
        setDraftQueue(null)
        setDraftIndex(0)
        try {
          await createCardFromDraft(drafts[0])
          toastSuccess(`卡片已创建：${drafts[0].title.trim()}`)
        } catch (e) {
          const message = e instanceof Error ? e.message : '创建失败'
          setDraftError(message)
          toastError(`创建失败：${message}`)
        }
      } else {
        openDraftQueue(drafts)
        toastInfo(`已生成 ${drafts.length} 张卡片草稿`)
      }
    },
    [createCardFromDraft, openDraftQueue]
  )

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', content: '已复制到剪贴板' }])
    } catch {
      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', content: '复制失败，请手动选择复制' }])
    }
  }, [setMessages])

  return {
    draft,
    setDraft,
    draftQueue,
    setDraftQueue,
    draftIndex,
    setDraftIndex,
    draftError,
    setDraftError,
    draftRaw,
    setDraftRaw,
    draftRepairedRaw,
    setDraftRepairedRaw,
    draftSubmitting,
    setDraftSubmitting,
    draftSourceId,
    setDraftSourceId,
    closeDraftPanel,
    openDraftQueue,
    handleCreateCurrentCard,
    handleCreateAllCards,
    handleGenerateDraft,
    handleQuickCreate,
    handleDraftsFromSend,
    copyToClipboard,
  }
}
