'use client'

import { useMemo, useRef, useState } from 'react'
import type { Card, Lane } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toastError, toastInfo, toastSuccess, toastWarning } from '@/components/ui/toast'
import { ToolCallConfirmation } from './ToolCallConfirmation'
import { OperationLogPanel } from './OperationLogPanel'
import { PromptBuilder, FallbackToolParser } from '@/lib/ai-tools'
import { parseCardDraftItemsFromAiContent } from '@/lib/ai/card-draft-parser'
import type { ToolCallRequest, OperationLogEntry, PromptContext, ChatMessage } from '@/types/ai-tools.types'
import type { CardDraft } from '@/lib/ai-tools/parser/card-draft-types'

type DraftParseResult =
  | { ok: true; drafts: CardDraft[]; raw: string; repairedRaw?: string }
  | { ok: false; error: string; raw: string; repairedRaw?: string }

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const guideMessage =
  'AI 创建卡片超快：\n' +
  '1) 在下方描述需求\n' +
  '2) 等 AI 回复后点「创建为卡片」\n' +
  '3) 需要改标题/描述再点「编辑后创建」\n\n' +
  '示例：帮我生成一个待办卡片：主题“优化拖拽体验”，给出标题和 3 条可执行描述。'

export function DeepSeekChatPanel({
  lanes,
  linkedCard,
  onCardCreated,
  onBoardRefresh,
  boardId,
}: {
  lanes: Lane[]
  linkedCard: Card | null
  onCardCreated: (laneId: string, card: Card) => void
  onBoardRefresh?: () => void | Promise<void>
  boardId?: string
}) {
  const [model, setModel] = useState<'deepseek-chat' | 'deepseek-reasoner'>('deepseek-chat')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'assistant',
      content: guideMessage,
    },
  ])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [draftSourceId, setDraftSourceId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CardDraft | null>(null)
  const [draftQueue, setDraftQueue] = useState<CardDraft[] | null>(null)
  const [draftIndex, setDraftIndex] = useState(0)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftRaw, setDraftRaw] = useState<string | null>(null)
  const [draftRepairedRaw, setDraftRepairedRaw] = useState<string | null>(null)
  const [draftSubmitting, setDraftSubmitting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // Tool call states
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallRequest[] | null>(null)
  const [pendingToolLogIds, setPendingToolLogIds] = useState<string[] | null>(null)
  const [operationLogs, setOperationLogs] = useState<OperationLogEntry[]>([])
  const [showLogPanel, setShowLogPanel] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  const defaultLaneId = linkedCard?.laneId || lanes[0]?.id || ''

  const laneById = useMemo(() => {
    const map = new Map<string, Lane>()
    for (const lane of lanes) map.set(lane.id, lane)
    return map
  }, [lanes])

  const existingCardTitles = useMemo(() => {
    const set = new Set<string>()
    for (const lane of lanes) {
      for (const card of lane.cards || []) {
        if (typeof card.title === 'string' && card.title.trim()) {
          set.add(card.title.trim().toLowerCase())
        }
      }
    }
    return set
  }, [lanes])

  const cardById = useMemo(() => {
    const map = new Map<string, { title: string; description?: string; laneId: string }>()
    for (const lane of lanes) {
      for (const card of lane.cards || []) {
        map.set(card.id, { title: card.title, description: card.description || undefined, laneId: card.laneId })
      }
    }
    return map
  }, [lanes])

  function sanitizeToolCalls(rawCalls: ToolCallRequest[]): ToolCallRequest[] {
    const calls = Array.isArray(rawCalls) ? rawCalls : []
    const hasNonCreate = calls.some((c) => c.toolName !== 'create_card')
    const deleteCardIds = new Set(
      calls
        .filter((c) => c.toolName === 'delete_card')
        .map((c) => (c.params as any)?.cardId)
        .filter((id) => typeof id === 'string') as string[]
    )
    const seenCreateTitles = new Set<string>()

    return calls.filter((c) => {
      if (c.toolName === 'create_card') {
        const title = typeof (c.params as any)?.title === 'string' ? ((c.params as any).title as string).trim() : ''
        const key = title.toLowerCase()
        if (!title) return false
        if (seenCreateTitles.has(key)) return false
        seenCreateTitles.add(key)
        if (hasNonCreate && existingCardTitles.has(key)) return false
        return true
      }

      if (c.toolName === 'update_card') {
        const cardId = typeof (c.params as any)?.cardId === 'string' ? ((c.params as any).cardId as string) : ''
        if (!cardId) return true
        if (deleteCardIds.has(cardId)) return false
        const existing = cardById.get(cardId)
        if (!existing) return true
        const title = typeof (c.params as any)?.title === 'string' ? ((c.params as any).title as string).trim() : undefined
        const description = typeof (c.params as any)?.description === 'string' ? ((c.params as any).description as string) : undefined
        const titleChanged = typeof title === 'string' && title.length > 0 && title !== existing.title
        const descChanged = typeof description === 'string' && description !== (existing.description || '')
        return titleChanged || descChanged
      }

      if (c.toolName === 'move_card') {
        const cardId = typeof (c.params as any)?.cardId === 'string' ? ((c.params as any).cardId as string) : ''
        if (!cardId) return true
        if (deleteCardIds.has(cardId)) return false
        const existing = cardById.get(cardId)
        if (!existing) return true
        const toLaneId = typeof (c.params as any)?.toLaneId === 'string' ? ((c.params as any).toLaneId as string) : ''
        if (!toLaneId) return true
        return toLaneId !== existing.laneId
      }

      return true
    })
  }

  async function callChatApi(payload: unknown): Promise<string> {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = typeof data?.error === 'string' ? data.error : 'AI 请求失败'
      throw new Error(message)
    }

    if (typeof data?.content !== 'string') {
      throw new Error('AI 返回格式异常')
    }

    return data.content
  }

  function buildSystemContext() {
    const context: PromptContext = {
      currentBoard: boardId ? { id: boardId, title: '当前看板' } : undefined,
      currentLanes: lanes.map((l) => ({
        id: l.id,
        title: l.title,
        cardCount: l.cards?.length || 0,
        cards: (l.cards || []).slice(0, 50).map((c) => ({ id: c.id, title: c.title })),
      })),
    }

    return PromptBuilder.buildToolSystemPrompt(context)
  }

  const quickTemplates = useMemo(
    () => [
      {
        label: '生成待办任务',
        text: '帮我生成一个待办卡片：主题“优化拖拽体验”，给出标题和 3 条可执行描述。',
      },
      {
        label: '拆分为子任务',
        text: '把下面需求拆成 3-5 张卡片（每张含标题 + 简短描述）：\n',
      },
      {
        label: '总结为卡片',
        text: '把下面内容总结成一张卡片（标题 + 简短描述）：\n',
      },
    ],
    []
  )

  function applyTemplate(text: string) {
    setInput(text)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function closeDraftPanel() {
    setDraft(null)
    setDraftQueue(null)
    setDraftIndex(0)
    setDraftRaw(null)
    setDraftRepairedRaw(null)
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', content: '已复制到剪贴板' }])
    } catch {
      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', content: '复制失败，请手动选择复制' }])
    }
  }

  async function createCardFromDraft(nextDraft: CardDraft) {
    const logId = createId()
    const timestamp = new Date().toISOString()
    const params: Record<string, unknown> = {
      boardId,
      laneId: nextDraft.laneId,
      title: nextDraft.title.trim(),
      description: nextDraft.description?.trim() || undefined,
    }

    setOperationLogs((prev) => [
      {
        id: logId,
        timestamp,
        status: 'confirmed',
        confirmedBy: 'user',
        toolName: 'create_card',
        params,
      },
      ...prev,
    ])

    console.log('[createCardFromDraft] 开始创建卡片:', nextDraft)
    const response = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardId,
        laneId: nextDraft.laneId,
        title: nextDraft.title.trim(),
        description: nextDraft.description?.trim() || undefined,
      }),
    })

    const data = await response.json().catch(() => ({}))
    console.log('[createCardFromDraft] API 响应:', { status: response.status, data })

    if (!response.ok || !data?.success) {
      const message = typeof data?.error === 'string' ? data.error : '创建卡片失败'
      setOperationLogs((prev) =>
        prev.map((l) =>
          l.id === logId
            ? { ...l, status: 'failed', error: message, timestamp: new Date().toISOString() }
            : l
        )
      )
      console.error('[createCardFromDraft] 创建失败:', message)
      throw new Error(message)
    }

    console.log('[createCardFromDraft] 创建成功，调用 onCardCreated')
    setOperationLogs((prev) =>
      prev.map((l) =>
        l.id === logId
          ? { ...l, status: 'executed', result: data.data, timestamp: new Date().toISOString() }
          : l
      )
    )
    onCardCreated(nextDraft.laneId, data.data as Card)
  }

  async function createCardsFromDrafts(drafts: CardDraft[]) {
    console.log('[createCardsFromDrafts] 开始创建卡片，总数:', drafts.length)
    const results: { success: boolean; title: string; error?: string }[] = []

    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i]
      if (!d.title.trim()) {
        console.log(`[createCardsFromDrafts] 跳过空标题草稿 (索引 ${i})`)
        continue
      }
      console.log(`[createCardsFromDrafts] [${i + 1}/${drafts.length}] 创建卡片:`, d.title)

      try {
        await createCardFromDraft(d)
        results.push({ success: true, title: d.title })
        console.log(`[createCardsFromDrafts] [${i + 1}/${drafts.length}] 创建成功:`, d.title)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[createCardsFromDrafts] [${i + 1}/${drafts.length}] 创建失败:`, d.title, errorMessage)
        results.push({ success: false, title: d.title, error: errorMessage })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length
    console.log(`[createCardsFromDrafts] 创建完成: 成功 ${successCount}, 失败 ${failCount}`)

    if (failCount > 0) {
      console.error('[createCardsFromDrafts] 失败的卡片:', results.filter((r) => !r.success))
    }

    return { results, successCount, failCount }
  }

  function itemsToDrafts(items: Array<{ title: string; description?: string }>) {
    if (!defaultLaneId) throw new Error('缺少目标列表')
    const drafts = items
      .map((i) => ({
        laneId: defaultLaneId,
        title: i.title,
        description: i.description || undefined,
      }))
      .filter((d) => d.title.trim().length > 0)
    if (drafts.length === 0) throw new Error('未能从 AI 结果中解析 title')
    return drafts
  }

  async function generateDraftsFromText(text: string): Promise<DraftParseResult> {
    const lane = laneById.get(defaultLaneId)

    // 检测用户意图是否为创建多张卡片
    const multiCardKeywords = ['拆分', '拆成', '多张', '多个', '子任务', '3-5张', '2-3张', '5张']
    const wantsMultiCard = multiCardKeywords.some((keyword) => text.includes(keyword))

    const prompt = [
      '请把下面内容整理为"看板卡片草稿"。',
      wantsMultiCard
        ? '需要生成多张卡片（3-5张），每张卡片包含独立的标题和描述。'
        : '生成一张卡片，包含标题和描述。',
      '只输出 JSON 数组，不要输出任何解释文字、代码块标记或其他内容。',
      '格式示例：[{"title":"第一张卡片标题","description":"详细描述"},{"title":"第二张卡片标题","description":"详细描述"}]',
      lane ? `目标列表：${lane.title}` : '',
      linkedCard ? `关联卡片上下文：${linkedCard.title}` : '',
      '内容：',
      text,
    ]
      .filter(Boolean)
      .join('\n')

    const content = await callChatApi({
      model,
      system: buildSystemContext(),
      messages: [{ role: 'user', content: prompt }],
    })

    console.log('[generateDraftsFromText] AI 返回内容:', content)

    try {
      const items = parseCardDraftItemsFromAiContent(content)
      const drafts = itemsToDrafts(items)
      console.log('[generateDraftsFromText] 解析成功，草稿数:', drafts.length, drafts)
      return { ok: true, drafts, raw: content }
    } catch (e) {
      const lastError = e instanceof Error ? e : new Error(String(e))
      console.log('[generateDraftsFromText] 解析失败，尝试二次格式化:', lastError.message)

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
          system: buildSystemContext(),
          messages: [{ role: 'user', content: repairPrompt }],
        })

        console.log('[generateDraftsFromText] 二次格式化返回内容:', repaired)

        const items = parseCardDraftItemsFromAiContent(repaired)
        const drafts = itemsToDrafts(items)
        return { ok: true, drafts, raw: content, repairedRaw: repaired }
      } catch (e2) {
        const lastError2 = e2 instanceof Error ? e2 : new Error(String(e2))
        return {
          ok: false,
          error: `未能从 AI 结果中解析卡片：${lastError2.message}`,
          raw: content,
        }
      }
    }
  }

  function openDraftQueue(drafts: CardDraft[]) {
    setDraftQueue(drafts)
    setDraftIndex(0)
    setDraft(drafts[0] || null)
  }

  async function handleSend() {
    const content = input.trim()
    if (!content || isSending) return

    setDraft(null)
    setDraftQueue(null)
    setDraftIndex(0)
    setDraftError(null)
    setDraftSourceId(null)
    setDraftRaw(null)
    setDraftRepairedRaw(null)

    const nextMessages: ChatMessage[] = [...messages, { id: createId(), role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)

    try {
      const aiContent = await callChatApi({
        model,
        system: buildSystemContext(),
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      })

      // 检测工具调用 - 统一使用降级解析器
      FallbackToolParser.setDefaultLaneId(defaultLaneId)
      const parseResult = FallbackToolParser.parse(aiContent)

      if (parseResult.type === 'tool_calls' && parseResult.data.length > 0) {
        // 工具调用成功，显示确认对话框
        const toolCalls = sanitizeToolCalls(parseResult.data as ToolCallRequest[])
        const removedCount = (parseResult.data as ToolCallRequest[]).length - toolCalls.length
        setPendingToolCalls(toolCalls)
        // 添加到日志（等待确认状态）
        const newLogIds: string[] = []
        const newLogs: OperationLogEntry[] = toolCalls.map((call) => {
          const id = createId()
          newLogIds.push(id)
          return {
            id,
            timestamp: new Date().toISOString(),
            status: 'pending' as const,
            toolName: call.toolName,
            params: call.params
          }
        })
        setPendingToolLogIds(newLogIds)
        setOperationLogs(prev => [...newLogs, ...prev])
        if (removedCount > 0) {
          toastWarning(`已忽略 ${removedCount} 个可疑/重复操作`)
        } else {
          toastInfo(`已生成 ${toolCalls.length} 个操作，等待确认`)
        }
      } else if (parseResult.type === 'draft' && parseResult.data.length > 0) {
        // 解析为草稿，打开编辑界面
        const drafts = parseResult.data as CardDraft[]

        // 如果只有一张草稿，直接创建；否则打开编辑队列
        if (drafts.length === 1) {
          setDraft(drafts[0])
          setDraftQueue(null)
          setDraftIndex(0)

          // 立即创建单张卡片
          try {
            await createCardFromDraft(drafts[0])
            toastSuccess(`卡片已创建：${drafts[0].title.trim()}`)
          } catch (e) {
            const message = e instanceof Error ? e.message : '创建失败'
            setDraftError(message)
            toastError(`创建失败：${message}`)
          }
        } else {
          // 多张草稿，打开编辑队列
          setDraftQueue(drafts)
          setDraftIndex(0)
          setDraft(drafts[0] || null)
          toastInfo(`已生成 ${drafts.length} 张卡片草稿`)
        }
      } else {
        setMessages((prev) => [...prev, { id: createId(), role: 'assistant', content: aiContent }])
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI 请求失败'
      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', content: `请求失败：${message}` }])
    } finally {
      setIsSending(false)
    }
  }

  async function handleGenerateDraft(source: ChatMessage) {
    if (isSending || draftSubmitting) return

    setDraft(null)
    setDraftQueue(null)
    setDraftIndex(0)
    setDraftError(null)
    setDraftSourceId(source.id)
    setDraftRaw(null)
    setDraftRepairedRaw(null)
    setDraftSubmitting(true)

    try {
      const result = await generateDraftsFromText(source.content)
      setDraftRaw(result.raw)
      setDraftRepairedRaw(result.repairedRaw ?? null)
      if (result.ok) {
        openDraftQueue(result.drafts)
        if (result.drafts.length > 1) {
          toastInfo(`已生成 ${result.drafts.length} 张卡片草稿`)
        }
      } else {
        const error = (result as DraftParseResult & { ok: false; error: string }).error
        setDraftError(error)
        openDraftQueue([
          {
            laneId: defaultLaneId,
            title: '',
            description: source.content,
          },
        ])
      }
    } finally {
      setDraftSubmitting(false)
    }
  }

  async function handleQuickCreate(source: ChatMessage) {
    if (isSending || draftSubmitting) return

    setDraft(null)
    setDraftQueue(null)
    setDraftIndex(0)
    setDraftError(null)
    setDraftSourceId(source.id)
    setDraftRaw(null)
    setDraftRepairedRaw(null)
    setDraftSubmitting(true)

    try {
      const result = await generateDraftsFromText(source.content)
      setDraftRaw(result.raw)
      setDraftRepairedRaw(result.repairedRaw ?? null)
      if (!result.ok) {
        const error = (result as DraftParseResult & { ok: false; error: string }).error
        throw new Error(error)
      }
      const { successCount, failCount } = await createCardsFromDrafts(result.drafts)
      if (failCount === 0) {
        toastSuccess(`已创建 ${successCount} 张卡片`)
      } else if (successCount > 0) {
        toastWarning(`已创建 ${successCount} 张，失败 ${failCount} 张`)
      } else {
        toastError(`创建失败：${failCount} 张`)
      }
      setDraftSourceId(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : '创建失败'
      setDraftError(message)
      openDraftQueue([
        {
          laneId: defaultLaneId,
          title: '',
          description: source.content,
        },
      ])
    } finally {
      setDraftSubmitting(false)
    }
  }

  async function handleCreateCurrentCard() {
    if (!draft || !draft.title.trim() || !draft.laneId || draftSubmitting) return

    setDraftSubmitting(true)
    setDraftError(null)

    try {
      const currentTitle = draft.title.trim()
      await createCardFromDraft(draft)
      toastSuccess(`卡片已创建：${currentTitle}`)

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
      const message = e instanceof Error ? e.message : '创建失败'
      setDraftError(message)
    } finally {
      setDraftSubmitting(false)
    }
  }

  async function handleCreateAllCards() {
    const list = draftQueue && draftQueue.length > 0 ? draftQueue : draft ? [draft] : []
    const drafts = list.filter((d) => d.title.trim())
    if (draftSubmitting || drafts.length === 0) return

    setDraftSubmitting(true)
    setDraftError(null)

    try {
      const { successCount, failCount } = await createCardsFromDrafts(drafts)
      if (failCount === 0) {
        toastSuccess(`已创建 ${successCount} 张卡片`)
      } else if (successCount > 0) {
        toastWarning(`已创建 ${successCount} 张，失败 ${failCount} 张`)
      } else {
        toastError(`创建失败：${failCount} 张`)
      }
      closeDraftPanel()
      setDraftSourceId(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : '创建失败'
      setDraftError(message)
    } finally {
      setDraftSubmitting(false)
    }
  }

  // Tool call handlers
  async function handleConfirmToolCalls() {
    if (!pendingToolCalls || isExecuting) return

    setIsExecuting(true)

    try {
      const affectedLogIds = pendingToolLogIds || []
      if (affectedLogIds.length > 0) {
        setOperationLogs((prev) =>
          prev.map((log) =>
            affectedLogIds.includes(log.id)
              ? { ...log, status: 'confirmed', confirmedBy: 'user', timestamp: new Date().toISOString() }
              : log
          )
        )
      }
      const response = await fetch('/api/ai/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolCalls: pendingToolCalls })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || '执行失败')
      }

      const results = data.data || []
      const timestamp = new Date().toISOString()

      // 更新日志状态
      setOperationLogs((prev) => {
        const updated = [...prev]
        const ids = pendingToolLogIds || []
        if (ids.length === results.length && ids.length > 0) {
          const map = new Map(updated.map((l) => [l.id, l]))
          for (let i = 0; i < results.length; i++) {
            const id = ids[i]
            const existing = map.get(id)
            if (!existing) continue
            map.set(id, {
              ...existing,
              status: results[i].success ? 'executed' : 'failed',
              result: results[i].result,
              error: results[i].error,
              timestamp,
            })
          }
          return updated.map((l) => map.get(l.id) || l)
        }
        let resultCursor = 0
        return updated.map((log) => {
          if (resultCursor >= results.length) return log
          if (log.status !== 'confirmed' && log.status !== 'pending') return log
          const r = results[resultCursor]
          resultCursor++
          return {
            ...log,
            status: r.success ? 'executed' : 'failed',
            result: r.result,
            error: r.error,
            timestamp,
          }
        })
      })

      const successCount = results.filter((r: any) => r.success).length
      const failCount = results.filter((r: any) => !r.success).length
      if (failCount === 0) {
        toastSuccess(`执行完成：成功 ${successCount} 个`)
      } else if (successCount > 0) {
        toastWarning(`执行完成：成功 ${successCount} 个，失败 ${failCount} 个`)
      } else {
        toastError(`执行失败：${failCount} 个`)
      }

      setPendingToolCalls(null)
      setPendingToolLogIds(null)

      if (onBoardRefresh) {
        await onBoardRefresh()
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '执行失败'
      toastError(`执行失败：${message}`)

      // 更新日志为失败状态
      const affectedLogIds = pendingToolLogIds || []
      if (affectedLogIds.length > 0) {
        setOperationLogs((prev) =>
          prev.map((log) =>
            affectedLogIds.includes(log.id)
              ? { ...log, status: 'failed', error: message, timestamp: new Date().toISOString() }
              : log
          )
        )
      }
    } finally {
      setIsExecuting(false)
    }
  }


  function handleCancelToolCalls() {
    if (!pendingToolCalls) return

    // 更新日志为取消状态
    const affectedLogIds = pendingToolLogIds || []
    if (affectedLogIds.length > 0) {
      setOperationLogs((prev) =>
        prev.map((log) =>
          affectedLogIds.includes(log.id)
            ? { ...log, status: 'cancelled', timestamp: new Date().toISOString() }
            : log
        )
      )
    }

    setPendingToolCalls(null)
    setPendingToolLogIds(null)
    toastInfo('已取消操作')
  }

  function clearLogs() {
    setOperationLogs([])
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">DeepSeek</div>
            <Badge variant="secondary" className="h-5 px-2 text-[10px]">
              {model === 'deepseek-reasoner' ? 'Reasoner' : 'Chat'}
            </Badge>
          </div>
          {linkedCard ? (
            <div className="mt-1 truncate text-xs text-muted-foreground">关联：{linkedCard.title}</div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">【AI一键创建卡片】</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as 'deepseek-chat' | 'deepseek-reasoner')}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="deepseek-chat">deepseek-chat</option>
            <option value="deepseek-reasoner">deepseek-reasoner</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLogPanel(!showLogPanel)}
          >
            {showLogPanel ? '隐藏日志' : `日志(${operationLogs.length})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMessages([
                {
                  id: createId(),
                  role: 'assistant',
                  content: guideMessage,
                },
              ])
              closeDraftPanel()
              setDraftError(null)
              setDraftSourceId(null)
            }}
          >
            清空
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={[
                  'max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                ].join(' ')}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.role === 'assistant' && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => handleQuickCreate(m)} disabled={draftSubmitting}>
                      {draftSubmitting && draftSourceId === m.id ? '创建中...' : '创建为卡片'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleGenerateDraft(m)} disabled={draftSubmitting}>
                      {draftSubmitting && draftSourceId === m.id ? '生成中...' : '编辑后创建'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(draft || draftError) && (
        <div className="border-t bg-background px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-xs font-medium">卡片草稿</div>
              {draftQueue && draftQueue.length > 1 && (
                <div className="text-[11px] text-muted-foreground">
                  {draftIndex + 1}/{draftQueue.length}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {draftQueue && draftQueue.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = Math.max(0, draftIndex - 1)
                      setDraftIndex(next)
                      setDraft(draftQueue[next] || null)
                    }}
                    disabled={draftSubmitting || draftIndex <= 0}
                  >
                    上一张
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = Math.min(draftQueue.length - 1, draftIndex + 1)
                      setDraftIndex(next)
                      setDraft(draftQueue[next] || null)
                    }}
                    disabled={draftSubmitting || draftIndex >= draftQueue.length - 1}
                  >
                    下一张
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={closeDraftPanel} disabled={draftSubmitting}>
                关闭
              </Button>
            </div>
          </div>

          {draftError && <div className="mt-2 text-xs text-destructive">{draftError}</div>}
          {(draftRaw || draftRepairedRaw) && (
            <div className="mt-2 space-y-2">
              {draftRepairedRaw && (
                <details className="rounded-md border bg-muted/40 px-2 py-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">查看二次格式化输出</summary>
                  <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-2 text-[11px] leading-relaxed">
                    {draftRepairedRaw}
                  </pre>
                  <div className="mt-2 flex items-center justify-end">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(draftRepairedRaw)}>
                      复制
                    </Button>
                  </div>
                </details>
              )}
              {draftRaw && (
                <details className="rounded-md border bg-muted/40 px-2 py-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">查看原始 AI 输出</summary>
                  <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-2 text-[11px] leading-relaxed">
                    {draftRaw}
                  </pre>
                  <div className="mt-2 flex items-center justify-end">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(draftRaw)}>
                      复制
                    </Button>
                  </div>
                </details>
              )}
            </div>
          )}
          {draft && (
            <div className="mt-2 space-y-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                placeholder="卡片标题"
                disabled={draftSubmitting}
              />
              <Textarea
                value={draft.description || ''}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                className="min-h-[88px] resize-none text-sm"
                placeholder="卡片描述（可选）"
                disabled={draftSubmitting}
              />
              <div className="flex items-center gap-2">
                <select
                  value={draft.laneId || defaultLaneId}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, laneId: e.target.value } : prev))}
                  className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                  disabled={draftSubmitting}
                >
                  {lanes.map((lane) => (
                    <option key={lane.id} value={lane.id}>
                      {lane.title}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={handleCreateCurrentCard} disabled={!draft.title.trim() || draftSubmitting}>
                  {draftSubmitting ? '创建中...' : '创建'}
                </Button>
                {draftQueue && draftQueue.length > 1 && (
                  <Button variant="outline" size="sm" onClick={handleCreateAllCards} disabled={draftSubmitting}>
                    全部创建
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border-t bg-background px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {quickTemplates.map((t) => (
            <Button key={t.label} type="button" variant="outline" size="sm" onClick={() => applyTemplate(t.text)}>
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题…（Enter 发送，Shift+Enter 换行）"
            className="min-h-[44px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            disabled={isSending}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isSending}>
            {isSending ? '发送中…' : '发送'}
          </Button>
        </div>
      </div>

      {/* Tool Call Confirmation Dialog */}
      {pendingToolCalls && (
        <ToolCallConfirmation
          open={!!pendingToolCalls}
          toolCalls={pendingToolCalls}
          onConfirm={handleConfirmToolCalls}
          onCancel={handleCancelToolCalls}
          isExecuting={isExecuting}
        />
      )}

      {/* Operation Log Panel (Overlay) */}
      {showLogPanel && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm">
          <div className="fixed right-0 top-0 h-full w-80 border-l bg-background shadow-lg">
            <OperationLogPanel
              logs={operationLogs}
              onClose={() => setShowLogPanel(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
