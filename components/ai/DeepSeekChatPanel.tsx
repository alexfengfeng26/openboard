'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Card, Lane } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toastError, toastInfo, toastSuccess, toastWarning } from '@/components/ui/toast'
import { ToolCallConfirmation } from './ToolCallConfirmation'
import { OperationLogPanel } from './OperationLogPanel'
import { PromptBuilder, FallbackToolParser } from '@/lib/ai-tools'
import { parseCardDraftItemsFromAiContent } from '@/lib/ai/card-draft-parser'
import type { ToolCallRequest, OperationLogEntry, PromptContext, ChatMessage } from '@/types/ai-tools.types'
import type { AiCommand } from '@/types/ai-commands.types'
import type { CardDraft } from '@/lib/ai-tools/parser/card-draft-types'
import type { AiToolTriggerConfig } from '@/types/settings.types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Settings } from 'lucide-react'
import {
  createDefaultAiCommands,
  exportAiCommandsToJsonText,
  exportAiCommandsToMarkdownText,
  normalizeAiCommands,
  parseAiCommandsFromText,
} from '@/lib/ai/commands'
import { useAiSettings } from '@/lib/hooks/useSettings'

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

type ToolTriggerScope = 'none' | 'all' | 'card' | 'lane' | 'board'

type ToolTriggerConfig = AiToolTriggerConfig

type SlashMenuItem = {
  key: string
  label: string
  description?: string
  insertText: string
}

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
  const { aiSettings, loading: settingsLoading, updateAiSettings } = useAiSettings()
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
  const [slashMenuDismissed, setSlashMenuDismissed] = useState(false)
  const [slashActiveIndex, setSlashActiveIndex] = useState(0)
  const [slashMenuAnchor, setSlashMenuAnchor] = useState<{ left: number; width: number; bottom: number } | null>(null)
  const [draftSourceId, setDraftSourceId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CardDraft | null>(null)
  const [draftQueue, setDraftQueue] = useState<CardDraft[] | null>(null)
  const [draftIndex, setDraftIndex] = useState(0)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftRaw, setDraftRaw] = useState<string | null>(null)
  const [draftRepairedRaw, setDraftRepairedRaw] = useState<string | null>(null)
  const [draftSubmitting, setDraftSubmitting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const commandImportInputRef = useRef<HTMLInputElement | null>(null)

  // Tool call states
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallRequest[] | null>(null)
  const [pendingToolLogIds, setPendingToolLogIds] = useState<string[] | null>(null)
  const [operationLogs, setOperationLogs] = useState<OperationLogEntry[]>([])
  const [showLogPanel, setShowLogPanel] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  const defaultLaneId = linkedCard?.laneId || lanes[0]?.id || ''
  const [actionableAssistantMessageIds, setActionableAssistantMessageIds] = useState<string[]>([])
  const [aiCommands, setAiCommands] = useState<AiCommand[]>([])
  const [toolTriggerConfig, setToolTriggerConfig] = useState<ToolTriggerConfig>({
    gateByPrefix: true,
    showQuickTemplatesInChat: false,
    showAssistantActionsInChat: true,
    prefixes: {
      all: '/kb',
      card: '/card',
      lane: '/lane',
      board: '/board',
    },
  })
  const [commandsLoaded, setCommandsLoaded] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<ToolTriggerConfig | null>(null)
  const [commandsDraft, setCommandsDraft] = useState<AiCommand[] | null>(null)

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

  // 从服务端设置加载配置
  useEffect(() => {
    if (aiSettings?.toolTrigger) {
      setToolTriggerConfig(aiSettings.toolTrigger)
    }
    if (aiSettings?.defaultModel) {
      setModel(aiSettings.defaultModel)
    }
  }, [aiSettings?.toolTrigger, aiSettings?.defaultModel])

  // 从服务端设置加载 AI 命令
  useEffect(() => {
    if (aiSettings?.commands && !commandsLoaded) {
      const commands = aiSettings.commands.length > 0 
        ? aiSettings.commands 
        : createDefaultAiCommands({
            prefixes: {
              all: aiSettings.toolTrigger?.prefixes?.all,
              card: aiSettings.toolTrigger?.prefixes?.card,
              lane: aiSettings.toolTrigger?.prefixes?.lane,
              board: aiSettings.toolTrigger?.prefixes?.board,
            }
          })
      setAiCommands(commands)
      setCommandsLoaded(true)
    }
  }, [aiSettings?.commands, aiSettings?.toolTrigger, commandsLoaded])

  useEffect(() => {
    if (settingsOpen) {
      setSettingsDraft(toolTriggerConfig)
      // 确保命令已加载
      if (aiSettings?.commands) {
        setCommandsDraft(aiSettings.commands.length > 0 ? aiSettings.commands : aiCommands)
      } else {
        setCommandsDraft(aiCommands)
      }
    } else {
      setSettingsDraft(null)
      setCommandsDraft(null)
    }
  }, [settingsOpen, toolTriggerConfig, aiCommands, aiSettings?.commands])

  async function persistToolTriggerConfig(next: ToolTriggerConfig) {
    setToolTriggerConfig(next)
    try {
      await updateAiSettings({ toolTrigger: next })
    } catch {
      // 错误已在 hook 中处理
    }
  }

  async function persistAiCommands(next: AiCommand[]) {
    setAiCommands(next)
    try {
      await updateAiSettings({ commands: next })
    } catch {
      // 错误已在 hook 中处理
    }
  }

  function downloadTextFile(filename: string, text: string, mimeType: string) {
    const blob = new Blob([text], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function updateCommandDraft(index: number, patch: Partial<AiCommand>) {
    setCommandsDraft((prev) => {
      if (!prev) return prev
      return prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    })
  }

  function removeCommandDraft(index: number) {
    setCommandsDraft((prev) => {
      if (!prev) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  function addCommandDraft() {
    setCommandsDraft((prev) => {
      const next = Array.isArray(prev) ? [...prev] : []
      const id = createId()
      next.push({
        id,
        trigger: '/cmd',
        kind: 'snippet',
        label: '/cmd',
        description: '',
        insertText: '',
        enabled: true,
        placement: 'slash',
      })
      return next
    })
  }

  const actionableAssistantMessageIdSet = useMemo(
    () => new Set(actionableAssistantMessageIds),
    [actionableAssistantMessageIds]
  )

  function shouldShowAssistantActions(messageId: string): boolean {
    if (!toolTriggerConfig.gateByPrefix) return true
    if (toolTriggerConfig.showAssistantActionsInChat) return true
    return actionableAssistantMessageIdSet.has(messageId)
  }

  const quickbarCommands = useMemo(() => {
    return aiCommands.filter(
      (c) =>
        c.enabled &&
        c.kind === 'snippet' &&
        (c.placement === 'quickbar' || c.placement === 'both')
    )
  }, [aiCommands])

  const slashQuery = useMemo(() => {
    const text = input.trimStart()
    if (!text.startsWith('/')) return null
    if (/\s/.test(text.slice(1))) return null
    return text
  }, [input])

  const slashMenuItems = useMemo((): SlashMenuItem[] => {
    const visible = aiCommands.filter((c) => c.enabled && (c.placement === 'slash' || c.placement === 'both'))
    const tool = visible.filter((c) => c.kind === 'tool_prefix')
    const snippet = visible.filter((c) => c.kind === 'snippet')

    return [...tool, ...snippet].map((c) => ({
      key: c.id,
      label: c.label || c.trigger,
      description: c.description,
      insertText: c.insertText,
    }))
  }, [aiCommands])

  const filteredSlashMenuItems = useMemo(() => {
    if (!slashQuery) return []
    const q = slashQuery.toLowerCase()
    return slashMenuItems.filter((item) => item.label.toLowerCase().startsWith(q) || item.label.toLowerCase().includes(q))
  }, [slashMenuItems, slashQuery])

  const slashMenuOpen = !!slashQuery && !slashMenuDismissed && filteredSlashMenuItems.length > 0

  useEffect(() => {
    if (!slashMenuOpen) return
    setSlashActiveIndex(0)
  }, [slashMenuOpen, slashQuery])

  useEffect(() => {
    if (!slashMenuOpen) {
      setSlashMenuAnchor(null)
      return
    }

    const update = () => {
      const el = inputRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setSlashMenuAnchor({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + 8,
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [slashMenuOpen, filteredSlashMenuItems.length])

  function handleInputChange(next: string) {
    setInput(next)
    setSlashMenuDismissed(false)
  }

  function applySlashMenuItem(item: SlashMenuItem) {
    setInput(item.insertText)
    setSlashMenuDismissed(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function handleSlashMenuKeyDown(e: React.KeyboardEvent) {
    if (!slashMenuOpen) return false

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSlashActiveIndex((prev) => Math.min(prev + 1, filteredSlashMenuItems.length - 1))
      return true
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSlashActiveIndex((prev) => Math.max(prev - 1, 0))
      return true
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setSlashMenuDismissed(true)
      return true
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const item = filteredSlashMenuItems[slashActiveIndex]
      if (item) applySlashMenuItem(item)
      return true
    }

    return false
  }

  function formatQuickbarLabel(label: string) {
    return label.replace(/^\/模板[:：]\s*/, '')
  }

  function getAllowedToolNames(scope: ToolTriggerScope): string[] | undefined {
    if (scope === 'card') return ['create_card', 'update_card', 'move_card', 'delete_card']
    if (scope === 'lane') return ['create_lane', 'update_lane', 'delete_lane']
    if (scope === 'board') return ['create_board', 'update_board', 'delete_board']
    if (scope === 'all') return undefined
    return []
  }

  function matchToolTrigger(raw: string): { scope: ToolTriggerScope; stripped: string } {
    if (!toolTriggerConfig.gateByPrefix) return { scope: 'all', stripped: raw }

    const text = raw.trimStart()
    const candidates = aiCommands
      .filter((c) => c.enabled && c.kind === 'tool_prefix' && typeof c.scope === 'string')
      .map((c) => ({ scope: c.scope as Exclude<ToolTriggerScope, 'none'>, prefix: c.trigger.trim() }))
      .filter((c) => c.prefix.length > 0)
      .sort((a, b) => b.prefix.length - a.prefix.length)

    for (const c of candidates) {
      if (!text.startsWith(c.prefix)) continue
      const nextChar = text.slice(c.prefix.length, c.prefix.length + 1)
      if (nextChar && !/[\s:：]/.test(nextChar)) continue
      const stripped = text.slice(c.prefix.length).replace(/^[:：]?\s*/, '')
      return { scope: c.scope, stripped: stripped.trim() }
    }

    return { scope: 'none', stripped: raw }
  }

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

    return context
  }

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
      system: PromptBuilder.buildChatSystemPrompt(buildSystemContext()),
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
          system: PromptBuilder.buildChatSystemPrompt(buildSystemContext()),
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
    const raw = input.trim()
    if (!raw || isSending) return
    const trigger = matchToolTrigger(raw)
    const content = trigger.scope === 'none' ? raw : trigger.stripped || raw

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
      const context = buildSystemContext()
      const toolTriggerHelp = toolTriggerConfig.gateByPrefix
        ? [
          '如需执行看板操作，请在消息开头加触发前缀：',
          ...aiCommands
            .filter((c) => c.enabled && c.kind === 'tool_prefix' && typeof c.scope === 'string' && c.trigger.trim())
            .map((c) => {
              const name =
                c.scope === 'all' ? '全部' : c.scope === 'card' ? '仅卡片' : c.scope === 'lane' ? '仅列表' : '仅看板'
              return `- ${name}：${c.trigger.trim()}`
            }),
        ]
          .filter(Boolean)
          .join('\n')
        : undefined

      const aiContent = await callChatApi({
        model,
        system:
          trigger.scope === 'none'
            ? PromptBuilder.buildChatSystemPrompt(context, { toolTriggerHelp })
            : PromptBuilder.buildToolSystemPrompt(context, { allowedToolNames: getAllowedToolNames(trigger.scope) }),
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      })

      if (trigger.scope === 'none') {
        const id = createId()
        setMessages((prev) => [...prev, { id, role: 'assistant', content: aiContent }])
        return
      }

      FallbackToolParser.setDefaultLaneId(defaultLaneId)
      const parseResult = FallbackToolParser.parse(aiContent)

      if (parseResult.type === 'tool_calls' && parseResult.data.length > 0) {
        const allowed = getAllowedToolNames(trigger.scope)
        const sanitized = sanitizeToolCalls(parseResult.data as ToolCallRequest[])
        const toolCalls = allowed && allowed.length > 0 ? sanitized.filter((c) => allowed.includes(c.toolName)) : sanitized
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
        const id = createId()
        setMessages((prev) => [...prev, { id, role: 'assistant', content: aiContent }])
        setActionableAssistantMessageIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
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
        </div>

        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={async (e) => {
              const newModel = e.target.value as 'deepseek-chat' | 'deepseek-reasoner'
              setModel(newModel)
              try {
                await updateAiSettings({ defaultModel: newModel })
              } catch {
                // 错误已在 hook 中处理
              }
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="deepseek-chat">deepseek-chat</option>
            <option value="deepseek-reasoner">deepseek-reasoner</option>
          </select>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>AI 操作触发设置</DialogTitle>
                <DialogDescription>用前缀触发卡片/列表/看板的 CRUD，避免影响普通聊天。</DialogDescription>
              </DialogHeader>

              {settingsDraft && commandsDraft && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={settingsDraft.gateByPrefix}
                      onChange={(e) =>
                        setSettingsDraft((prev) => (prev ? { ...prev, gateByPrefix: e.target.checked } : prev))
                      }
                    />
                    仅当消息以触发前缀开头时才启用工具
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={settingsDraft.showQuickTemplatesInChat}
                      onChange={(e) =>
                        setSettingsDraft((prev) => (prev ? { ...prev, showQuickTemplatesInChat: e.target.checked } : prev))
                      }
                    />
                    普通聊天中显示快捷模板按钮
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={settingsDraft.showAssistantActionsInChat}
                      onChange={(e) =>
                        setSettingsDraft((prev) =>
                          prev ? { ...prev, showAssistantActionsInChat: e.target.checked } : prev
                        )
                      }
                    />
                    普通聊天中显示“创建为卡片/编辑后创建”
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium">Commands</div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadTextFile('ai-commands.json', exportAiCommandsToJsonText(commandsDraft), 'application/json')}
                        >
                          导出 JSON
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadTextFile('ai-commands.md', exportAiCommandsToMarkdownText(commandsDraft), 'text/markdown')}
                        >
                          导出 MD
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => commandImportInputRef.current?.click()}
                        >
                          导入
                        </Button>
                        <Button variant="outline" size="sm" onClick={addCommandDraft}>
                          新增
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCommandsDraft(createDefaultAiCommands())}>
                          重置
                        </Button>
                        <input
                          ref={commandImportInputRef}
                          type="file"
                          accept=".json,.md,.txt,application/json,text/markdown,text/plain"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            void (async () => {
                              const text = await file.text()
                              const parsed = parseAiCommandsFromText(text)
                              if (!parsed || parsed.length === 0) {
                                toastError('导入失败：未识别到 commands')
                              } else {
                                setCommandsDraft(parsed)
                                toastSuccess(`已导入 ${parsed.length} 条 command`)
                              }
                              e.target.value = ''
                            })()
                          }}
                        />
                      </div>
                    </div>

                    <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-2">
                      {commandsDraft.map((c, idx) => (
                        <div key={c.id} className="space-y-2 rounded-md border p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={c.enabled}
                                onChange={(e) => updateCommandDraft(idx, { enabled: e.target.checked })}
                              />
                              启用
                            </label>
                            <div className="min-w-0 flex-1">
                              <Input
                                value={c.trigger}
                                onChange={(e) => updateCommandDraft(idx, { trigger: e.target.value })}
                                placeholder="/card"
                              />
                            </div>
                            <select
                              value={c.kind}
                              onChange={(e) => {
                                const kind = e.target.value as AiCommand['kind']
                                updateCommandDraft(idx, {
                                  kind,
                                  scope: kind === 'tool_prefix' ? (c.scope || 'all') : undefined,
                                  placement: kind === 'tool_prefix' ? 'slash' : c.placement,
                                })
                              }}
                              className="h-9 rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="tool_prefix">tool</option>
                              <option value="snippet">snippet</option>
                            </select>
                            {c.kind === 'tool_prefix' && (
                              <select
                                value={c.scope || 'all'}
                                onChange={(e) => updateCommandDraft(idx, { scope: e.target.value as any })}
                                className="h-9 rounded-md border bg-background px-2 text-sm"
                              >
                                <option value="all">all</option>
                                <option value="card">card</option>
                                <option value="lane">lane</option>
                                <option value="board">board</option>
                              </select>
                            )}
                            <select
                              value={c.placement}
                              onChange={(e) => updateCommandDraft(idx, { placement: e.target.value as any })}
                              className="h-9 rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="slash">slash</option>
                              <option value="quickbar">quickbar</option>
                              <option value="both">both</option>
                            </select>
                            <Button variant="outline" size="sm" onClick={() => removeCommandDraft(idx)}>
                              删除
                            </Button>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="grid gap-1">
                              <div className="text-xs text-muted-foreground">菜单标题</div>
                              <Input value={c.label} onChange={(e) => updateCommandDraft(idx, { label: e.target.value })} />
                            </div>
                            <div className="grid gap-1">
                              <div className="text-xs text-muted-foreground">描述（可选）</div>
                              <Input
                                value={c.description || ''}
                                onChange={(e) => updateCommandDraft(idx, { description: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="grid gap-1">
                            <div className="text-xs text-muted-foreground">插入内容</div>
                            <Textarea
                              value={c.insertText}
                              onChange={(e) => updateCommandDraft(idx, { insertText: e.target.value })}
                              className="min-h-[64px] resize-none text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                      取消
                    </Button>
                    <Button
                      onClick={async () => {
                        const normalized = normalizeAiCommands(commandsDraft)
                        if (normalized.length !== commandsDraft.length) {
                          toastWarning('部分 command 被忽略：可能是重复触发词或缺少必要字段')
                        }
                        await persistAiCommands(normalized)
                        await persistToolTriggerConfig(settingsDraft)
                        setSettingsOpen(false)
                        toastSuccess('已保存设置')
                      }}
                      disabled={settingsLoading}
                    >
                      {settingsLoading ? '保存中...' : '保存'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
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
              setActionableAssistantMessageIds([])
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
                {m.role === 'assistant' && shouldShowAssistantActions(m.id) && (
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
        {(!toolTriggerConfig.gateByPrefix || toolTriggerConfig.showQuickTemplatesInChat) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {quickbarCommands.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyTemplate(c.insertText)}
              >
                {formatQuickbarLabel(c.label)}
              </Button>
            ))}
          </div>
        )}
        {slashMenuOpen &&
          slashMenuAnchor &&
          createPortal(
            <div
              style={{ position: 'fixed', left: slashMenuAnchor.left, width: slashMenuAnchor.width, bottom: slashMenuAnchor.bottom }}
              className="z-[9999] overflow-hidden rounded-md border bg-background shadow-lg"
              onKeyDown={(e) => {
                handleSlashMenuKeyDown(e)
              }}
            >
              <div className="max-h-56 overflow-y-auto p-1">
                {filteredSlashMenuItems.map((item, idx) => (
                  <button
                    key={item.key}
                    type="button"
                    tabIndex={-1}
                    className={[
                      'w-full rounded-md px-2 py-1.5 text-left text-sm',
                      idx === slashActiveIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                    ].join(' ')}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setSlashActiveIndex(idx)}
                    onClick={() => applySlashMenuItem(item)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate font-medium">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground">Enter</div>
                    </div>
                    {item.description && (
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.description}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}
        <div className="relative flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="输入你的问题…（Enter 发送，Shift+Enter 换行）"
            className="min-h-[44px] resize-none text-sm"
            onKeyDownCapture={(e) => {
              const handled = handleSlashMenuKeyDown(e)
              if (handled) return
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
