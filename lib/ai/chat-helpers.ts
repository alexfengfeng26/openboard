import type { ToolCallRequest, PromptContext, OperationLogEntry } from '@/types/ai-tools.types'
import type { Lane, Tag } from '@/lib/db'

const COMMON_TAG_ALIASES: Record<string, string[]> = {
  紧急: ['urgent', '高优先级', '优先', 'p0'],
  Bug: ['缺陷', '问题', '错误'],
  优化: ['改进', '优化项'],
  文档: ['说明', '资料', 'wiki'],
  设计: ['ui', '视觉'],
}

export interface CardFallbackCandidate {
  laneId: string
  laneTitle: string
  cardId: string
  cardTitle: string
  matchedTags: string[]
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '').replace(/[“”"'`.,，。:：!！?？()[\]{}<>/\\|]/g, '')
}

function getTagAliases(tagName: string): string[] {
  return COMMON_TAG_ALIASES[tagName] || []
}

function matchesQueryToken(query: string, token: string): boolean {
  const normalizedQuery = normalizeForMatch(query)
  const normalizedToken = normalizeForMatch(token)
  return normalizedToken.length > 0 && normalizedQuery.includes(normalizedToken)
}

export function looksLikeNoMatchResponse(text: string): boolean {
  const normalized = normalizeForMatch(text)
  return (
    /没有.*符合条件/.test(normalized) ||
    /未找到.*卡片/.test(normalized) ||
    /没有.*卡片需要/.test(normalized) ||
    /没有.*匹配/.test(normalized) ||
    /找不到.*卡片/.test(normalized)
  )
}

function extractBalancedArraySlice(text: string, startIndex: number): string | null {
  let depth = 0
  let inString = false
  let stringQuote: '"' | "'" | null = null
  let escaped = false

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (stringQuote && ch === stringQuote) {
        inString = false
        stringQuote = null
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      stringQuote = ch as '"' | "'"
      continue
    }

    if (ch === '[') depth++
    if (ch === ']') {
      depth--
      if (depth === 0) return text.slice(startIndex, i + 1)
    }
  }

  return null
}

function extractJsonArrayFromText(text: string): unknown[] {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [
    codeBlockMatch?.[1] ?? '',
    text,
  ]

  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    if (!trimmed) continue

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) return parsed
    } catch {
      // continue
    }

    const startIndex = trimmed.indexOf('[')
    if (startIndex === -1) continue
    const slice = extractBalancedArraySlice(trimmed, startIndex)
    if (!slice) continue
    try {
      const parsed = JSON.parse(slice) as unknown
      if (Array.isArray(parsed)) return parsed
    } catch {
      // continue
    }
  }

  return []
}

export function parseLegacyCardActionToolCalls(
  text: string,
  boardId: string | undefined,
  lanes: Lane[],
  tags?: Tag[]
): ToolCallRequest[] {
  if (!boardId || !/\/card\b/i.test(text)) return []

  const actions = extractJsonArrayFromText(text)
  if (actions.length === 0) return []

  const laneById = new Map(lanes.map((lane) => [lane.id, lane]))
  const laneByTitle = new Map(lanes.map((lane) => [normalizeForMatch(lane.title), lane]))
  const tagPool = tags && tags.length > 0 ? tags : Array.from(
    new Map(
      lanes.flatMap((lane) => (lane.cards || []).flatMap((card) => card.tags || []))
        .map((tag) => [tag.id, tag] as const)
    ).values()
  )

  const tagByName = new Map(tagPool.map((tag) => [normalizeForMatch(tag.name), tag]))

  const calls: ToolCallRequest[] = []

  for (const action of actions) {
    if (!action || typeof action !== 'object') continue
    const obj = action as Record<string, unknown>
    const kind = typeof obj.action === 'string' ? obj.action.toLowerCase() : ''
    const cardId = typeof obj.cardId === 'string' ? obj.cardId : ''
    if (!cardId) continue

    if (kind === 'move') {
      const targetLaneId = typeof obj.targetLaneId === 'string'
        ? obj.targetLaneId
        : typeof obj.laneId === 'string'
          ? obj.laneId
          : ''
      if (!targetLaneId) continue

      const normalizedLaneId = laneById.has(targetLaneId)
        ? targetLaneId
        : laneByTitle.get(normalizeForMatch(targetLaneId))?.id || ''
      if (!normalizedLaneId) continue

      calls.push({
        toolName: 'move_card',
        params: {
          boardId,
          cardId,
          toLaneId: normalizedLaneId,
        },
      })
      continue
    }

    if (kind === 'update') {
      const data = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : {}
      const title = typeof data.title === 'string' ? data.title : undefined
      const description = typeof data.description === 'string' ? data.description : undefined

      if (title || description) {
        const params: Record<string, unknown> = { boardId, cardId }
        if (title) params.title = title
        if (description) params.description = description
        calls.push({ toolName: 'update_card', params })
      }

      const rawTags = Array.isArray(data.tags) ? data.tags : []
      if (rawTags.length > 0) {
        const lane = lanes.find((currentLane) => (currentLane.cards || []).some((card) => card.id === cardId))
        const currentCard = lane?.cards.find((card) => card.id === cardId)
        const currentTagNames = new Set((currentCard?.tags || []).map((tag) => normalizeForMatch(tag.name)))
        const desiredTags = rawTags
          .map((tag) => {
            if (typeof tag === 'string') return tag.trim()
            if (tag && typeof tag === 'object' && typeof (tag as Record<string, unknown>).name === 'string') {
              return String((tag as Record<string, unknown>).name).trim()
            }
            return ''
          })
          .filter(Boolean)
          .map((name) => ({ raw: name, normalized: normalizeForMatch(name) }))

        const addTags = desiredTags
          .filter(({ normalized }) => !currentTagNames.has(normalized))
          .map(({ raw, normalized }) => tagByName.get(normalized) || {
            id: `tag-${normalized}-${Date.now()}`,
            name: raw,
            color: '#6b7280',
          })
        const removeTagIds = (currentCard?.tags || [])
          .filter((tag) => !desiredTags.some(({ normalized }) => normalized === normalizeForMatch(tag.name)))
          .map((tag) => tag.id)

        if (addTags.length > 0 || removeTagIds.length > 0) {
          calls.push({
            toolName: 'batch_update_card_tags',
            params: {
              boardId,
              cardIds: [cardId],
              addTags,
              removeTagIds,
            },
          })
        }
      }
    }
  }

  return calls
}

export function looksLikeToolIntent(text: string): boolean {
  const normalized = text.trim()
  if (!normalized) return false
  const patterns = [
    /(?:移动|迁移|转移).*(?:卡片|列表|看板)?/i,
    /(?:添加|加上|打上).*(?:标签|tag|标记)/i,
    /(?:创建|新建|新增).*(?:卡片|列表|看板)/i,
    /(?:删除|移除).*(?:卡片|列表|看板|标签)/i,
    /(?:更新|编辑|修改).*(?:卡片|列表|看板|标签)/i,
    /(?:批量|全部|所有).*(?:移动|删除|更新|添加).*/i,
  ]
  return patterns.some((pattern) => pattern.test(normalized))
}

export function findTaggedCardCandidates(
  lanes: Lane[],
  tags: Tag[] | undefined,
  query: string
): CardFallbackCandidate[] {
  const tagPool = tags && tags.length > 0 ? tags : Array.from(
    new Map(
      lanes.flatMap((lane) => (lane.cards || []).flatMap((card) => card.tags || []))
        .map((tag) => [tag.id, tag] as const)
    ).values()
  )

  const mentionedTags = tagPool.filter((tag) => {
    if (matchesQueryToken(query, tag.name)) return true
    return getTagAliases(tag.name).some((alias) => matchesQueryToken(query, alias))
  })

  const mentionedLaneIds = lanes
    .filter((lane) => matchesQueryToken(query, lane.title))
    .map((lane) => lane.id)

  const candidateLanes = mentionedLaneIds.length > 0
    ? lanes.filter((lane) => mentionedLaneIds.includes(lane.id))
    : lanes

  if (mentionedTags.length === 0) return []

  const mentionedTagNames = new Set(mentionedTags.map((tag) => tag.name))

  const candidates: CardFallbackCandidate[] = []
  for (const lane of candidateLanes) {
    for (const card of lane.cards || []) {
      const matchedTags = (card.tags || [])
        .filter((tag) => mentionedTagNames.has(tag.name))
        .map((tag) => tag.name)
      if (matchedTags.length === 0) continue
      candidates.push({
        laneId: lane.id,
        laneTitle: lane.title,
        cardId: card.id,
        cardTitle: card.title,
        matchedTags,
      })
    }
  }

  return candidates
}

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
    const aliasHints = tags
      .map((t) => {
        const aliases = COMMON_TAG_ALIASES[t.name]
        if (!aliases || aliases.length === 0) return null
        return `${t.name}≈${aliases.join(' / ')}`
      })
      .filter((v): v is string => typeof v === 'string')
    if (aliasHints.length > 0) {
      parts.push(`标签别名参考：${aliasHints.join('； ')}`)
    }
  }

  parts.push('判断卡片是否命中某个标签时，必须以卡片自身的 tags 字段为准；不要只看“可用标签”列表，也不要根据标题猜测。')
  parts.push('如果用户要求按标签筛选、移动或批量处理卡片，但你无法百分之百确认匹配结果，请先列出候选卡片并询问确认，不要直接断言“没有符合条件的卡片”。')

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
          batch_update_card_tags: '批量更新标签',
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
        tags: c.tags?.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
        })),
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
