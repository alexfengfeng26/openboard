'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { Card, Lane } from '@/lib/db'
import { toastInfo, toastWarning } from '@/components/ui/toast'
import { ToolCallConfirmation } from './ToolCallConfirmation'
import { OperationLogPanel } from './OperationLogPanel'
import { ChatHeader } from './ChatHeader'
import { ChatMessageList } from './ChatMessageList'
import { ChatInputArea } from './ChatInputArea'
import { SlashCommandMenu, type SlashMenuItem } from './SlashCommandMenu'
import { DraftEditorPanel } from './DraftEditorPanel'
import { PromptBuilder, FallbackToolParser } from '@/lib/ai-tools'
import type { ToolCallRequest, ChatMessage } from '@/types/ai-tools.types'
import type { AiCommand } from '@/types/ai-commands.types'
import type { CardDraft } from '@/lib/ai-tools/parser/card-draft-types'
import type { AiSettings, AiToolTriggerConfig } from '@/types/settings.types'
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
} from '@/lib/ai/chat-helpers'

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
  linkedCard,
  onCardCreated,
  onBoardRefresh,
  boardId,
  boardTitle,
}: {
  lanes: Lane[]
  linkedCard: Card | null
  onCardCreated: (laneId: string, card: Card) => void
  onBoardRefresh?: () => void | Promise<void>
  boardId?: string
  boardTitle?: string
}) {
  const { aiSettings, loading: settingsLoading, updateAiSettings } = useAiSettings()
  const [model, setModel] = useState<'deepseek-chat' | 'deepseek-reasoner'>('deepseek-chat')
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

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
    const map = new Map<string, { title: string; description?: string; laneId: string }>()
    for (const lane of lanes) {
      for (const card of lane.cards || []) {
        map.set(card.id, { title: card.title, description: card.description || undefined, laneId: card.laneId })
      }
    }
    return map
  }, [lanes])

  useEffect(() => {
    if (aiSettings?.toolTrigger) setToolTriggerConfig(aiSettings.toolTrigger)
    if (aiSettings?.defaultModel) setModel(aiSettings.defaultModel)
  }, [aiSettings?.toolTrigger, aiSettings?.defaultModel])

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
    return [...tool, ...snippet].map((c) => ({ key: c.id, label: c.label || c.trigger, description: c.description, insertText: c.insertText }))
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
    return { scope: 'none', stripped: raw }
  }

  function applyTemplate(text: string) {
    setInput(text)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

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
      const context = buildSystemContext(boardId, boardTitle, lanes)
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

      const aiContent = await callChatApi({
        model,
        system:
          trigger.scope === 'none'
            ? PromptBuilder.buildChatSystemPrompt(context, { toolTriggerHelp })
            : PromptBuilder.buildToolSystemPrompt(context, { allowedToolNames: getAllowedToolNames(trigger.scope) }),
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      })

      if (trigger.scope === 'none') {
        const id = createChatId()
        setMessages((prev) => [...prev, { id, role: 'assistant', content: aiContent }])
        return
      }

      FallbackToolParser.setDefaultLaneId(defaultLaneId)
      const parseResult = FallbackToolParser.parse(aiContent)

      if (parseResult.type === 'tool_calls' && parseResult.data.length > 0) {
        const allowed = getAllowedToolNames(trigger.scope)
        const sanitized = sanitizeToolCalls(parseResult.data as ToolCallRequest[], existingCardTitles, cardById)
        const toolCalls = allowed && allowed.length > 0 ? sanitized.filter((c) => allowed.includes(c.toolName)) : sanitized
        const removedCount = (parseResult.data as ToolCallRequest[]).length - toolCalls.length
        tools.setPendingToolCalls(toolCalls)
        const newLogIds: string[] = []
        const newLogs = toolCalls.map((call) => {
          const id = createChatId()
          newLogIds.push(id)
          return { id, timestamp: new Date().toISOString(), status: 'pending' as const, toolName: call.toolName, params: call.params }
        })
        tools.setPendingToolLogIds(newLogIds)
        setOperationLogs((prev) => [...newLogs, ...prev])
        if (removedCount > 0) toastWarning(`已忽略 ${removedCount} 个可疑/重复操作`)
        else toastInfo(`已生成 ${toolCalls.length} 个操作，等待确认`)
      } else if (parseResult.type === 'draft' && parseResult.data.length > 0) {
        await drafts.handleDraftsFromSend(parseResult.data as CardDraft[])
      } else {
        const id = createChatId()
        setMessages((prev) => [...prev, { id, role: 'assistant', content: aiContent }])
        setActionableAssistantMessageIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI 请求失败'
      setMessages((prev) => [...prev, { id: createChatId(), role: 'assistant', content: `请求失败：${message}` }])
    } finally {
      setIsSending(false)
    }
  }

  const handleModelChange = useCallback(
    async (newModel: 'deepseek-chat' | 'deepseek-reasoner') => {
      setModel(newModel)
      try {
        await updateAiSettings({ defaultModel: newModel })
      } catch {
        // ignore
      }
    },
    [updateAiSettings]
  )

  const handleClearChat = useCallback(() => {
    setMessages([{ id: createChatId(), role: 'assistant', content: guideMessage }])
    setActionableAssistantMessageIds([])
    drafts.closeDraftPanel()
    drafts.setDraftError(null)
    drafts.setDraftSourceId(null)
  }, [setMessages, drafts])

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        model={model}
        onModelChange={handleModelChange}
        showLogPanel={showLogPanel}
        onToggleLogPanel={() => setShowLogPanel(!showLogPanel)}
        operationLogsCount={operationLogs.length}
        onClearChat={handleClearChat}
        settingsOpen={settingsOpen}
        onSettingsOpen={setSettingsOpen}
        aiSettings={aiSettings}
        settingsLoading={settingsLoading}
        onAiSettingsChange={handleAiSettingsChange}
      />
      <ChatMessageList
        messages={messages}
        isSending={isSending}
        shouldShowAssistantActions={shouldShowAssistantActions}
        onQuickCreate={(m) => drafts.handleQuickCreate(m, model, () => buildSystemContext(boardId, boardTitle, lanes))}
        onGenerateDraft={(m) => drafts.handleGenerateDraft(m, model, () => buildSystemContext(boardId, boardTitle, lanes))}
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
          onConfirm={tools.handleConfirmToolCalls}
          onCancel={tools.handleCancelToolCalls}
          isExecuting={tools.isExecuting}
        />
      )}
      {showLogPanel && (
        <div className="fixed inset-0 z-40 bg-black/10">
          <div className="fixed right-0 top-0 h-full w-80 border-l border-border bg-background shadow-lg shadow-black/5">
            <OperationLogPanel logs={operationLogs} onClose={() => setShowLogPanel(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
