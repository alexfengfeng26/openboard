import type { AiCommand, AiCommandPlacement, AiCommandScope } from '@/types/ai-commands.types'

export const AI_COMMANDS_STORAGE_KEY = 'kanban.aiCommands.v1'

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createDefaultAiCommands(options?: {
  prefixes?: Partial<Record<'all' | 'card' | 'lane' | 'board', string>>
}): AiCommand[] {
  const prefixes = {
    all: options?.prefixes?.all ?? '/kb',
    card: options?.prefixes?.card ?? '/card',
    lane: options?.prefixes?.lane ?? '/lane',
    board: options?.prefixes?.board ?? '/board',
  }

  const prefixCommands: AiCommand[] = ([
    { scope: 'all' as const, trigger: prefixes.all, label: prefixes.all, description: '执行卡片/列表/看板操作' },
    { scope: 'card' as const, trigger: prefixes.card, label: prefixes.card, description: '仅卡片 CRUD' },
    { scope: 'lane' as const, trigger: prefixes.lane, label: prefixes.lane, description: '仅列表 CRUD' },
    { scope: 'board' as const, trigger: prefixes.board, label: prefixes.board, description: '仅看板 CRUD' },
  ] as const)
    .filter((c) => typeof c.trigger === 'string' && c.trigger.trim().length > 0)
    .map((c) => ({
      id: createId(),
      trigger: c.trigger.trim(),
      kind: 'tool_prefix' as const,
      scope: c.scope,
      label: c.label,
      description: c.description,
      insertText: `${c.trigger.trim()} `,
      enabled: true,
      placement: 'slash' as const,
    }))

  const templateCommands: AiCommand[] = [
    {
      id: createId(),
      trigger: '/模板：生成待办任务',
      kind: 'snippet',
      label: '/模板：生成待办任务',
      description: '插入一段常用提问模板',
      insertText: '帮我生成一个待办卡片：主题“优化拖拽体验”，给出标题和 3 条可执行描述。',
      enabled: true,
      placement: 'both',
    },
    {
      id: createId(),
      trigger: '/模板：拆分为子任务',
      kind: 'snippet',
      label: '/模板：拆分为子任务',
      description: '插入一段常用提问模板',
      insertText: '把下面需求拆成 3-5 张卡片（每张含标题 + 简短描述）：\n',
      enabled: true,
      placement: 'both',
    },
    {
      id: createId(),
      trigger: '/模板：总结为卡片',
      kind: 'snippet',
      label: '/模板：总结为卡片',
      description: '插入一段常用提问模板',
      insertText: '把下面内容总结成一张卡片（标题 + 简短描述）：\n',
      enabled: true,
      placement: 'both',
    },
  ]

  return normalizeAiCommands([...prefixCommands, ...templateCommands])
}

export function normalizeAiCommands(commands: AiCommand[]): AiCommand[] {
  const seen = new Set<string>()
  const next: AiCommand[] = []
  for (const c of commands) {
    if (!c || typeof c !== 'object') continue
    const trigger = typeof c.trigger === 'string' ? c.trigger.trim() : ''
    const label = typeof c.label === 'string' ? c.label.trim() : ''
    const insertText = typeof c.insertText === 'string' ? c.insertText : ''
    const enabled = typeof c.enabled === 'boolean' ? c.enabled : true
    const placement = normalizePlacement(c.placement)

    if (!trigger || !label) continue
    const key = trigger.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    if (c.kind === 'tool_prefix') {
      const scope = normalizeScope(c.scope)
      if (!scope) continue
      next.push({
        id: typeof c.id === 'string' && c.id ? c.id : createId(),
        trigger,
        kind: 'tool_prefix',
        scope,
        label,
        description: typeof c.description === 'string' ? c.description : undefined,
        insertText: insertText || `${trigger} `,
        enabled,
        placement,
      })
      continue
    }

    if (c.kind === 'snippet') {
      next.push({
        id: typeof c.id === 'string' && c.id ? c.id : createId(),
        trigger,
        kind: 'snippet',
        label,
        description: typeof c.description === 'string' ? c.description : undefined,
        insertText,
        enabled,
        placement,
      })
    }
  }

  return next
}

function normalizeScope(scope: unknown): AiCommandScope | null {
  if (scope === 'all' || scope === 'card' || scope === 'lane' || scope === 'board') return scope
  return null
}

function normalizePlacement(placement: unknown): AiCommandPlacement {
  if (placement === 'slash' || placement === 'quickbar' || placement === 'both') return placement
  return 'slash'
}

export function loadAiCommandsFromLocalStorage(): AiCommand[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AI_COMMANDS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return normalizeAiCommands(parsed as AiCommand[])
  } catch {
    return null
  }
}

export function saveAiCommandsToLocalStorage(commands: AiCommand[]) {
  if (typeof window === 'undefined') return
  const normalized = normalizeAiCommands(commands)
  window.localStorage.setItem(AI_COMMANDS_STORAGE_KEY, JSON.stringify(normalized))
}

export function ensureAiCommandsInLocalStorage(options?: {
  prefixes?: Partial<Record<'all' | 'card' | 'lane' | 'board', string>>
}): AiCommand[] {
  const existing = loadAiCommandsFromLocalStorage()
  if (existing && existing.length > 0) return existing
  const defaults = createDefaultAiCommands({ prefixes: options?.prefixes })
  saveAiCommandsToLocalStorage(defaults)
  return defaults
}

export function exportAiCommandsToJsonText(commands: AiCommand[]): string {
  const normalized = normalizeAiCommands(commands)
  return JSON.stringify(normalized, null, 2)
}

export function exportAiCommandsToMarkdownText(commands: AiCommand[]): string {
  const json = exportAiCommandsToJsonText(commands)
  return ['# AI Commands', '', '```json', json, '```', ''].join('\n')
}

export function parseAiCommandsFromText(text: string): AiCommand[] {
  const trimmed = (text || '').trim()
  if (!trimmed) return []

  const direct = tryParseJson(trimmed)
  if (direct) return normalizeAiCommands(extractCommandsFromParsed(direct))

  const jsonBlocks = extractJsonCodeBlocks(trimmed)
  for (const block of jsonBlocks) {
    const parsed = tryParseJson(block)
    if (parsed) return normalizeAiCommands(extractCommandsFromParsed(parsed))
  }

  return []
}

function extractCommandsFromParsed(parsed: unknown): AiCommand[] {
  if (Array.isArray(parsed)) return parsed as AiCommand[]
  if (parsed && typeof parsed === 'object') {
    const maybeCommands = (parsed as any).commands
    if (Array.isArray(maybeCommands)) return maybeCommands as AiCommand[]
  }
  return []
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function extractJsonCodeBlocks(md: string): string[] {
  const blocks: string[] = []
  const regex = /```json\s*([\s\S]*?)```/gi
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(md))) {
    const raw = (match[1] || '').trim()
    if (raw) blocks.push(raw)
  }
  return blocks
}
