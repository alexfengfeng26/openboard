import type { ToolCallRequest, PromptContext, OperationLogEntry } from '@/types/ai-tools.types'
import type { Lane, Tag } from '@/lib/db'

export function createChatId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getAllowedToolNames(scope: string): string[] | undefined {
  if (scope === 'card') return ['create_card', 'update_card', 'move_card', 'delete_card']
  if (scope === 'lane') return ['create_lane', 'update_lane', 'delete_lane']
  if (scope === 'board') return ['create_board', 'update_board', 'delete_board']
  if (scope === 'all') return undefined
  return []
}

export function formatQuickbarLabel(label: string) {
  return label.replace(/^\/模板[:：]\s*/, '')
}

export function buildSystemContext(
  boardId: string | undefined,
  boardTitle: string | undefined,
  lanes: Lane[],
  tags?: Tag[],
  recentLogs?: OperationLogEntry[]
): PromptContext {
  const truncated = lanes.some((l) => (l.cards?.length || 0) > 50)
  const parts: string[] = []

  if (truncated) {
    parts.push('注意：部分列表卡片数量超过 50 张，已截断显示。如需查看或操作全部卡片，请使用工具。')
  }

  if (tags && tags.length > 0) {
    parts.push(`可用标签：${tags.map((t) => `${t.name} (颜色: ${t.color})`).join('， ')}`)
  }

  if (recentLogs && recentLogs.length > 0) {
    const recent = recentLogs
      .filter((l) => l.status === 'executed')
      .slice(0, 5)
      .map((l) => {
        const toolDesc: Record<string, string> = {
          create_card: '创建卡片',
          update_card: '更新卡片',
          move_card: '移动卡片',
          delete_card: '删除卡片',
          create_lane: '创建列表',
          update_lane: '更新列表',
          delete_lane: '删除列表',
          create_board: '创建看板',
          update_board: '更新看板',
          delete_board: '删除看板',
          search_cards: '搜索卡片',
          batch_update_cards: '批量更新卡片',
          add_tag_to_card: '添加标签',
          remove_tag_from_card: '移除标签',
          copy_card: '复制卡片',
        }
        const desc = toolDesc[l.toolName] || l.toolName
        const title = l.params?.title || l.params?.cardId || ''
        return `- ${desc}${title ? ` "${title}"` : ''}`
      })
    if (recent.length > 0) {
      parts.push(`最近操作：\n${recent.join('\n')}`)
    }
  }

  const context: PromptContext = {
    currentBoard: boardId ? { id: boardId, title: boardTitle || '当前看板' } : undefined,
    currentLanes: lanes.map((l) => ({
      id: l.id,
      title: l.title,
      cardCount: l.cards?.length || 0,
      cards: (l.cards || []).slice(0, 50).map((c) => ({
        id: c.id,
        title: c.title,
      })),
    })),
  }

  if (parts.length > 0) {
    context.note = parts.join('\n\n')
  }

  return context
}

function getParamString(params: Record<string, unknown>, key: string): string | undefined {
  const val = params[key]
  return typeof val === 'string' ? val : undefined
}

export function sanitizeToolCalls(
  rawCalls: ToolCallRequest[],
  existingCardTitles: Set<string>,
  cardById: Map<string, { title: string; description?: string; laneId: string }>
): ToolCallRequest[] {
  const calls = Array.isArray(rawCalls) ? rawCalls : []
  const hasNonCreate = calls.some((c) => c.toolName !== 'create_card')
  const deleteCardIds = new Set(
    calls
      .filter((c) => c.toolName === 'delete_card')
      .map((c) => getParamString(c.params, 'cardId'))
      .filter((id): id is string => typeof id === 'string')
  )
  const seenCreateTitles = new Set<string>()

  return calls.filter((c) => {
    if (c.toolName === 'create_card') {
      const title = getParamString(c.params, 'title')?.trim() || ''
      const key = title.toLowerCase()
      if (!title) return false
      if (seenCreateTitles.has(key)) return false
      seenCreateTitles.add(key)
      if (hasNonCreate && existingCardTitles.has(key)) return false
      return true
    }
    if (c.toolName === 'update_card') {
      const cardId = getParamString(c.params, 'cardId') || ''
      if (!cardId) return true
      if (deleteCardIds.has(cardId)) return false
      const existing = cardById.get(cardId)
      if (!existing) return true
      const title = getParamString(c.params, 'title')?.trim()
      const description = getParamString(c.params, 'description')
      const titleChanged = typeof title === 'string' && title.length > 0 && title !== existing.title
      const descChanged = typeof description === 'string' && description !== (existing.description || '')
      return titleChanged || descChanged
    }
    if (c.toolName === 'move_card') {
      const cardId = getParamString(c.params, 'cardId') || ''
      if (!cardId) return true
      if (deleteCardIds.has(cardId)) return false
      const existing = cardById.get(cardId)
      if (!existing) return true
      const toLaneId = getParamString(c.params, 'toLaneId') || ''
      if (!toLaneId) return true
      return toLaneId !== existing.laneId
    }
    return true
  })
}
