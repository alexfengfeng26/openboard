'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Card, Lane, Tag } from '@/lib/db'
import { toastInfo, toastWarning } from '@/components/ui/toast'
import { ToolCallConfirmation } from './ToolCallConfirmation'
import { OperationLogPanel } from './OperationLogPanel'
import { AiSettingsDialog } from './AiSettingsDialog'
import { ChatHeader } from './ChatHeader'
import { ChatMessageList } from './ChatMessageList'
import { ChatInputArea } from './ChatInputArea'
import { SlashCommandMenu, type SlashMenuItem } from './SlashCommandMenu'
import { DraftEditorPanel } from './DraftEditorPanel'
import { PromptBuilder, FallbackToolParser } from '@/lib/ai-tools'
import type { ToolCallRequest, ChatMessage, OperationLogEntry, AiExecutionPlan } from '@/types/ai-tools.types'
import type { AiCommand } from '@/types/ai-commands.types'
import type { CardDraft } from '@/lib/ai-tools/parser/card-draft-types'
import type { AiSettings, AiModel, AiToolTriggerConfig } from '@/types/settings.types'
import { createDefaultAiCommands } from '@/lib/ai/commands'
import { useAiSettings } from '@/lib/hooks/useSettings'
import { useChatMessages } from '@/lib/hooks/useChatMessages'
import { useOperationLogs } from '@/lib/hooks/useOperationLogs'
import { useAiToolCalls } from '@/lib/hooks/useAiToolCalls'
import { useChatDrafts } from '@/lib/hooks/useChatDrafts'
import {
  createChatId,
  getAllowedToolNames,
  buildSystemContext,
  sanitizeToolCalls,
  findTaggedCardCandidates,
  looksLikeNoMatchResponse,
  looksLikeToolIntent,
  parseLegacyCardActionToolCalls,
} from '@/lib/ai/chat-helpers'
import { canAutoExecute, getToolRiskSummary } from '@/lib/ai/tool-risk'

const guideMessage =
  'AI 创建卡片超快：\n' +
  '1) 在下方描述需求\n' +
  '2) 等 AI 回复后点「创建为卡片」\n' +
  '3) 需要改标题/描述再点「编辑后创建」\n\n' +
  '示例：帮我生成一个待办卡片：主题"优化拖拽体验"，给出标题和 3 条可执行描述。'

type ToolTriggerScope = 'none' | 'all' | 'card' | 'lane' | 'board'
type ToolTriggerConfig = AiToolTriggerConfig

export function DeepSeekChatPanel({
  lanes,
  tags,
  linkedCard,
  onCardCreated,
  onBoardRefresh,
  onRequestMinimize,
  onRequestClose,
  boardId,
  boardTitle,
  externalSettingsOpen,
  onExternalSettingsOpenChange,
  onStatusChange,
}: {
  lanes: Lane[]
  tags?: Tag[]
  linkedCard: Card | null
  onCardCreated: (laneId: string, card: Card) => void
  onBoardRefresh?: () => void | Promise<void>
  onRequestMinimize?: () => void
  onRequestClose?: () => void
  boardId?: string
  boardTitle?: string
  externalSettingsOpen?: boolean
  onExternalSettingsOpenChange?: (open: boolean) => void
  onStatusChange?: (status: { operationLogs: OperationLogEntry[]; isSending: boolean }) => void
}) {
  const { aiSettings, loading: settingsLoading, updateAiSettings } = useAiSettings()
  const model = aiSettings?.defaultModel ?? 'deepseek-v4-flash'

  const { messages, setMessages, input, setInput, isSending, setIsSending } = useChatMessages(boardId)
  const { logs: operationLogs, setLogs: setOperationLogs, showLogPanel, setShowLogPanel } = useOperationLogs(boardId)

  const [slashMenuDismissed, setSlashMenuDismissed] = useState(false)
  const [slashActiveIndex, setSlashActiveIndex] = useState(0)
  const [slashMenuAnchor, setSlashMenuAnchor] = useState<{ left: number; width: number; bottom: number } | null>(null)
  const [actionableAssistantMessageIds, setActionableAssistantMessageIds] = useState<string[]>([])
  const [aiCommands, setAiCommands] = useState<AiCommand[]>([])
  const [toolTriggerConfig, setToolTriggerConfig] = useState<ToolTriggerConfig>({
    gateByPrefix: true,
    showQuickTemplatesInChat: false,
    showAssistantActionsInChat: true,
    prefixes: { all: '/kb', card: '/card', lane: '/lane', board: '/board' },
  })
  const [commandsLoaded, setCommandsLoaded] = useState(false)
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<AiExecutionPlan | null>(null)
  const settingsOpen = externalSettingsOpen !== undefined ? externalSettingsOpen : internalSettingsOpen
  const setSettingsOpen = (open: boolean) => {
    if (onExternalSettingsOpenChange) {
      onExternalSettingsOpenChange(open)
    } else {
      setInternalSettingsOpen(open)
    }
  }
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    onStatusChange?.({ operationLogs, isSending })
  }, [onStatusChange, operationLogs, isSending])

  const defaultLaneId = linkedCard?.laneId || lanes[0]?.id || ''

  const drafts = useChatDrafts({
    boardId,
    defaultLaneId,
    linkedCard,
    onCardCreated,
    setMessages,
    setOperationLogs,
  })

  const tools = useAiToolCalls({ onBoardRefresh, setOperationLogs })

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
    const map = new Map<string, { title: string; description?: string; laneId: string; tags?: Tag[] }>()
    for (const lane of lanes) {
      for (const card of lane.cards || []) {
        map.set(card.id, { title: card.title, description: card.description || undefined, laneId: card.laneId, tags: card.tags || [] })
      }
    }
    return map
  }, [lanes])

  useEffect(() => {
    if (aiSettings?.toolTrigger) setToolTriggerConfig(aiSettings.toolTrigger)
  }, [aiSettings?.toolTrigger])

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
            },
          })
      setAiCommands(commands)
      setCommandsLoaded(true)
    }
  }, [aiSettings?.commands, aiSettings?.toolTrigger, commandsLoaded])

  // 监听外部打开 AI 面板的事件（如 LaneItem 的 AI 按钮）
  useEffect(() => {
    function handleOpenAI(e: CustomEvent<{ laneId?: string; prefix?: string }>) {
      if (e.detail?.prefix) {
        setInput(e.detail.prefix)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    }
    window.addEventListener('ai-panel-open', handleOpenAI as EventListener)
    return () => window.removeEventListener('ai-panel-open', handleOpenAI as EventListener)
  }, [setInput])

  async function handleAiSettingsChange(settings: Partial<AiSettings>) {
    if (settings.toolTrigger) setToolTriggerConfig(settings.toolTrigger)
    if (settings.commands) setAiCommands(settings.commands)
    await updateAiSettings(settings)
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
    return aiCommands.filter((c) => c.enabled && c.kind === 'snippet' && (c.placement === 'quickbar' || c.placement === 'both'))
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
    return [...tool, ...snippet].map((c) => ({ key: c.id, label: c.label || c.trigger, description: c.description, insertText: c.insertText, kind: c.kind === 'tool_prefix' ? 'tool' : 'snippet' as const }))
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
      setSlashMenuAnchor({ left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 8 })
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
    if (e.key === 'Tab') {
      e.preventDefault()
      const item = filteredSlashMenuItems[slashActiveIndex]
      if (item) applySlashMenuItem(item)
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
    if (looksLikeToolIntent(text)) {
      return { scope: 'all', stripped: raw }
    }
    return { scope: 'none', stripped: raw }
  }

  function applyTemplate(text: string) {
    setInput(text)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  async function callChatApi(payload: unknown): Promise<string> {
    const endpoint = '/api/ai/chat'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abortControllerRef.current?.signal,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = typeof data?.error === 'string'
        ? data.error
        : typeof data?.message === 'string'
          ? data.message
          : 'AI 请求失败'
      throw new Error(`${endpoint} ${response.status}: ${detail}`)
    }
    if (typeof data?.content !== 'string') throw new Error('AI 返回格式异常')
    return data.content
  }

  async function callPlanApi(toolCalls: ToolCallRequest[]): Promise<AiExecutionPlan> {
    const mode = aiSettings?.execution?.defaultMode ?? 'balanced'
    const endpoint = '/api/ai/plan'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolCalls, mode }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.success || !data?.data) {
      const detail = typeof data?.error === 'string'
        ? data.error
        : typeof data?.message === 'string'
          ? data.message
          : '生成执行计划失败'
      throw new Error(`${endpoint} ${response.status}: ${detail}`)
    }
    return data.data as AiExecutionPlan
  }

  async function callChatApiStream(payload: unknown): Promise<ReadableStream<Uint8Array>> {
    const endpoint = '/api/ai/chat'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...((payload ?? {}) as Record<string, unknown>), stream: true }),
      signal: abortControllerRef.current?.signal,
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const detail = typeof data?.error === 'string'
        ? data.error
        : typeof data?.message === 'string'
          ? data.message
          : 'AI 请求失败'
      throw new Error(`${endpoint} ${response.status}: ${detail}`)
    }
    if (!response.body) throw new Error('无法获取响应流')
    return response.body
  }

  async function readStream(
    stream: ReadableStream<Uint8Array>,
    onChunk: (content: string) => void
  ): Promise<string> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (typeof content === 'string') {
              fullContent += content
              onChunk(fullContent)
            }
          } catch {
            // ignore parse error
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return fullContent
  }

  async function handleSend() {
    const raw = input.trim()
    if (!raw || isSending) return
    const trigger = matchToolTrigger(raw)
    const content = trigger.scope === 'none' ? raw : trigger.stripped || raw

    drafts.closeDraftPanel()
    drafts.setDraftError(null)
    drafts.setDraftSourceId(null)
    drafts.setDraftRaw(null)
    drafts.setDraftRepairedRaw(null)

    const nextMessages: ChatMessage[] = [...messages, { id: createChatId(), role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)

    try {
      // 取消之前的请求
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      const recentLogs = operationLogs.slice(0, 10)
      const context = buildSystemContext(boardId, boardTitle, lanes, tags, recentLogs)
      const toolTriggerHelp = toolTriggerConfig.gateByPrefix
        ? [
            '如需执行看板操作，请在消息开头加触发前缀：',
            ...aiCommands
              .filter((c) => c.enabled && c.kind === 'tool_prefix' && typeof c.scope === 'string' && c.trigger.trim())
              .map((c) => {
                const name = c.scope === 'all' ? '全部' : c.scope === 'card' ? '仅卡片' : c.scope === 'lane' ? '仅列表' : '仅看板'
                return `- ${name}：${c.trigger.trim()}`
              }),
          ]
            .filter(Boolean)
            .join('\n')
        : undefined

      const payload = {
        model,
        system:
          trigger.scope === 'none'
            ? PromptBuilder.buildChatSystemPrompt(context, { toolTriggerHelp })
            : PromptBuilder.buildToolSystemPrompt(context, { allowedToolNames: getAllowedToolNames(trigger.scope) }),
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      }

      if (trigger.scope === 'none') {
        // 普通聊天模式：流式输出，实时显示
        const assistantId = createChatId()
        setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

        const stream = await callChatApiStream(payload)
        const fullContent = await readStream(stream, (content) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content } : m)))
        })
        if (!fullContent.trim()) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: '请求失败：AI 返回为空，请稍后重试。' } : m))
          )
          return
        }

        setActionableAssistantMessageIds((prev) =>
          prev.includes(assistantId) ? prev : [...prev, assistantId]
        )
        return
      }

      // 工具模式：非流式，快速获取完整响应后解析
      const aiContent = await callChatApi(payload)
      let assistantReplyContent = aiContent

      FallbackToolParser.setDefaultLaneId(defaultLaneId)
      const parseResult = FallbackToolParser.parse(aiContent)

      let parsedToolCalls = parseResult.type === 'tool_calls' && parseResult.data.length > 0
        ? (parseResult.data as ToolCallRequest[])
        : null

      if (!parsedToolCalls) {
        const legacyToolCalls = parseLegacyCardActionToolCalls(aiContent, boardId, lanes, tags)
        if (legacyToolCalls.length > 0) {
          parsedToolCalls = legacyToolCalls
        }
      }

      if (!parsedToolCalls && looksLikeNoMatchResponse(aiContent)) {
        const fallbackCandidates = findTaggedCardCandidates(lanes, tags, content)
        if (fallbackCandidates.length > 0) {
          const candidateSummary = fallbackCandidates.slice(0, 12).map((card) => {
            const tagText = card.matchedTags.length > 0 ? `, 标签: ${card.matchedTags.join('、')}` : ''
            return `- ${card.laneTitle} / ${card.cardTitle} (ID: ${card.cardId}${tagText})`
          }).join('\n')
          const retrySystem = [
            PromptBuilder.buildToolSystemPrompt(context, { allowedToolNames: getAllowedToolNames(trigger.scope) }),
            '## 系统兜底',
            '你刚刚判断“没有符合条件的卡片”，但系统扫描发现了候选卡片。请基于用户原始要求重新生成工具调用，只输出 JSON，不要输出解释。',
            `候选卡片：\n${candidateSummary}`,
          ].join('\n\n')
          const retryContent = await callChatApi({
            ...payload,
            system: retrySystem,
          })
          const retryParse = FallbackToolParser.parse(retryContent)
          if (retryParse.type === 'tool_calls' && retryParse.data.length > 0) {
            parsedToolCalls = retryParse.data as ToolCallRequest[]
          } else {
            assistantReplyContent = retryContent
          }
        }
      }

      if (parsedToolCalls && parsedToolCalls.length > 0) {
        const allowed = getAllowedToolNames(trigger.scope)
        const sanitized = sanitizeToolCalls(parsedToolCalls, existingCardTitles, cardById)
        const toolCalls = allowed && allowed.length > 0 ? sanitized.filter((c) => allowed.includes(c.toolName)) : sanitized
        const removedCount = parsedToolCalls.length - toolCalls.length

        if (toolCalls.length === 0) {
          if (removedCount > 0) toastWarning(`已忽略 ${removedCount} 个可疑/重复操作`)
          return
        }

        const plan = await callPlanApi(toolCalls)
        const trustMode = aiSettings?.trustMode || 'confirm_high_risk'
        const autoExecute = plan.autoExecutable && canAutoExecute(toolCalls, trustMode)

        const newLogIds: string[] = []
        const newLogs = plan.steps.map((step) => {
          const id = createChatId()
          newLogIds.push(id)
          return {
            id,
            timestamp: new Date().toISOString(),
            status: 'pending' as const,
            toolName: step.toolCall.toolName,
            params: step.toolCall.params,
            planId: plan.planId,
            stepId: step.stepId,
            riskLevel: step.riskLevel,
          }
        })
        tools.setPendingToolLogIds(newLogIds)
        setOperationLogs((prev) => [...newLogs, ...prev])

        if (removedCount > 0) toastWarning(`已忽略 ${removedCount} 个可疑/重复操作`)

        if (autoExecute) {
          toastInfo(`AI 自动执行 ${plan.steps.length} 个操作（${getToolRiskSummary(toolCalls)}）`)
          const executed = await tools.handleExecutePlan(plan, {
            confirmedBy: 'auto',
            toolLogIds: newLogIds,
          })
          if (executed && aiSettings?.autoMinimizeAfterAction !== false) {
            onRequestMinimize?.()
          }
        } else {
          setPendingPlan(plan)
          tools.setPendingToolCalls(plan.steps.map((s) => s.toolCall))
          const summary = getToolRiskSummary(toolCalls)
          toastInfo(`已生成 ${plan.steps.length} 个操作，${summary}，等待确认`)
        }
      } else if (parseResult.type === 'draft' && parseResult.data.length > 0) {
        await drafts.handleDraftsFromSend(parseResult.data as CardDraft[])
      } else {
        const id = createChatId()
        setMessages((prev) => [...prev, { id, role: 'assistant', content: assistantReplyContent }])
        setActionableAssistantMessageIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI 请求失败'
      // 流式模式下如果是因为主动取消（组件卸载或新请求），不显示错误
      if (message.includes('aborted') || message.includes('取消')) return
      setMessages((prev) => [...prev, { id: createChatId(), role: 'assistant', content: `请求失败：${message}` }])
    } finally {
      setIsSending(false)
      abortControllerRef.current = null
    }
  }

  const handleModelChange = useCallback(
    async (newModel: AiModel) => {
      try {
        await updateAiSettings({ defaultModel: newModel })
      } catch {
        // ignore
      }
    },
    [updateAiSettings]
  )

  const handleClearChat = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsSending(false)
    setMessages([{ id: createChatId(), role: 'assistant', content: guideMessage }])
    setActionableAssistantMessageIds([])
    drafts.closeDraftPanel()
    drafts.setDraftError(null)
    drafts.setDraftSourceId(null)
  }, [setMessages, setIsSending, drafts])

  return (
    <div className="pixel-ai-panel relative flex h-full flex-col overflow-hidden">
      <ChatHeader
        model={model}
        onModelChange={handleModelChange}
        showLogPanel={showLogPanel}
        onToggleLogPanel={() => setShowLogPanel((prev) => !prev)}
        operationLogsCount={operationLogs.length}
        onClearChat={handleClearChat}
        onRequestMinimize={onRequestMinimize}
        onRequestClose={onRequestClose}
      />
      {settingsOpen && aiSettings && (
        <AiSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          aiSettings={aiSettings}
          onAiSettingsChange={handleAiSettingsChange}
          loading={settingsLoading}
        />
      )}
      <ChatMessageList
        messages={messages}
        isSending={isSending}
        shouldShowAssistantActions={shouldShowAssistantActions}
        onQuickCreate={(m) => drafts.handleQuickCreate(m, model, () => buildSystemContext(boardId, boardTitle, lanes, tags, operationLogs.slice(0, 10)))}
        onGenerateDraft={(m) => drafts.handleGenerateDraft(m, model, () => buildSystemContext(boardId, boardTitle, lanes, tags, operationLogs.slice(0, 10)))}
        draftSubmitting={drafts.draftSubmitting}
        draftSourceId={drafts.draftSourceId}
      />
      <DraftEditorPanel
        draft={drafts.draft}
        draftQueue={drafts.draftQueue}
        draftIndex={drafts.draftIndex}
        draftError={drafts.draftError}
        draftRaw={drafts.draftRaw}
        draftRepairedRaw={drafts.draftRepairedRaw}
        draftSubmitting={drafts.draftSubmitting}
        lanes={lanes}
        defaultLaneId={defaultLaneId}
        onTitleChange={(title) => drafts.setDraft((prev) => (prev ? { ...prev, title } : prev))}
        onDescriptionChange={(description) => drafts.setDraft((prev) => (prev ? { ...prev, description } : prev))}
        onLaneIdChange={(laneId) => drafts.setDraft((prev) => (prev ? { ...prev, laneId } : prev))}
        onPrev={() => {
          const next = Math.max(0, drafts.draftIndex - 1)
          drafts.setDraftIndex(next)
          drafts.setDraft(drafts.draftQueue?.[next] || null)
        }}
        onNext={() => {
          if (!drafts.draftQueue) return
          const next = Math.min(drafts.draftQueue.length - 1, drafts.draftIndex + 1)
          drafts.setDraftIndex(next)
          drafts.setDraft(drafts.draftQueue[next] || null)
        }}
        onClose={drafts.closeDraftPanel}
        onCreateCurrent={drafts.handleCreateCurrentCard}
        onCreateAll={drafts.handleCreateAllCards}
        onCopyToClipboard={drafts.copyToClipboard}
      />
      <ChatInputArea
        input={input}
        onInputChange={handleInputChange}
        onSend={handleSend}
        isSending={isSending}
        inputRef={inputRef}
        quickbarCommands={quickbarCommands}
        toolTriggerConfig={toolTriggerConfig}
        onApplyTemplate={applyTemplate}
        onInputKeyDownCapture={handleSlashMenuKeyDown}
        onStop={() => {
          abortControllerRef.current?.abort()
          abortControllerRef.current = null
          setIsSending(false)
        }}
      >
        <SlashCommandMenu
          open={slashMenuOpen}
          anchor={slashMenuAnchor}
          items={filteredSlashMenuItems}
          activeIndex={slashActiveIndex}
          onSelect={applySlashMenuItem}
          onActiveIndexChange={setSlashActiveIndex}
          onDismiss={() => setSlashMenuDismissed(true)}
        />
      </ChatInputArea>
      {tools.pendingToolCalls && (
        <ToolCallConfirmation
          open={!!tools.pendingToolCalls}
          toolCalls={tools.pendingToolCalls}
          onConfirm={async () => {
            let executed = false
            if (pendingPlan) {
              executed = await tools.handleExecutePlan(pendingPlan, {
                confirmedBy: 'user',
                toolLogIds: tools.pendingToolLogIds ?? undefined,
              })
              setPendingPlan(null)
            } else {
              executed = await tools.handleConfirmToolCalls()
            }
            if (executed && aiSettings?.autoMinimizeAfterAction !== false) {
              onRequestMinimize?.()
            }
          }}
          onCancel={() => {
            setPendingPlan(null)
            tools.handleCancelToolCalls()
          }}
          isExecuting={tools.isExecuting}
        />
      )}
      {showLogPanel && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[120] bg-black/12 backdrop-blur-[1px]">
          <div className="fixed right-3 top-3 h-[calc(100%-24px)] w-[min(360px,calc(100vw-24px))]">
            <OperationLogPanel
              logs={operationLogs}
              boardId={boardId}
              onClose={() => setShowLogPanel(false)}
              onUndone={onBoardRefresh}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
