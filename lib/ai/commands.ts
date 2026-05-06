import type { AiCommand, AiCommandPlacement, AiCommandScope } from '@/types/ai-commands.types'

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
    {
      id: createId(),
      trigger: '/站会',
      kind: 'snippet',
      label: '/站会 — 每日站会模板',
      description: '生成每日站会三张卡片：昨日完成 / 今日计划 / 阻塞项',
      insertText: '帮我生成每日站会的 3 张卡片：\n1. 昨日完成的工作\n2. 今日计划\n3. 当前的阻塞或风险\n每张卡片包含标题和简短描述。',
      enabled: true,
      placement: 'both',
    },
    {
      id: createId(),
      trigger: '/sprint',
      kind: 'snippet',
      label: '/sprint — Sprint 规划',
      description: '生成本 Sprint 的规划卡片',
      insertText: '帮我生成本 Sprint 的规划卡片，包含：\n1. Sprint 目标\n2. 关键任务（3-5 张）\n3. 验收标准\n每张卡片给出标题和描述。',
      enabled: true,
      placement: 'both',
    },
    {
      id: createId(),
      trigger: '/review',
      kind: 'snippet',
      label: '/review — 代码审查待办',
      description: '生成代码审查相关的检查清单卡片',
      insertText: '帮我生成代码审查的检查清单卡片，包含：\n1. 代码规范性检查\n2. 逻辑正确性检查\n3. 性能影响评估\n4. 测试覆盖检查\n每张卡片给出标题和关键检查点。',
      enabled: true,
      placement: 'both',
    },
    {
      id: createId(),
      trigger: '/bug',
      kind: 'snippet',
      label: '/bug — Bug 报告模板',
      description: '生成标准的 Bug 报告卡片',
      insertText: '帮我生成一张 Bug 报告卡片，包含以下信息：\n- 问题描述\n- 复现步骤\n- 期望结果\n- 实际结果\n- 环境信息',
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

/**
 * @deprecated 设置已迁移到服务端存储，使用 lib/hooks/useSettings.ts
 * 这些函数保留用于向后兼容和工具函数
 */
export function loadAiCommandsFromLocalStorage(): AiCommand[] | null {
  // 已弃用：设置现在存储在服务端
  return null
}

/**
 * @deprecated 设置已迁移到服务端存储，使用 lib/hooks/useSettings.ts
 */
export function saveAiCommandsToLocalStorage(_commands: AiCommand[]) {
  // 已弃用：设置现在存储在服务端
}

/**
 * @deprecated 设置已迁移到服务端存储，使用 lib/hooks/useSettings.ts
 */
export function ensureAiCommandsInLocalStorage(options?: {
  prefixes?: Partial<Record<'all' | 'card' | 'lane' | 'board', string>>
}): AiCommand[] {
  // 返回默认命令，实际存储在服务端
  return createDefaultAiCommands({ prefixes: options?.prefixes })
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
