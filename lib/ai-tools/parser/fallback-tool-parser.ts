import type { ToolCallRequest } from '@/types/ai-tools.types'
import type { CardDraft } from './card-draft-types'

export class FallbackToolParser {
  private static defaultLaneId = ''

  static setDefaultLaneId(laneId: string) {
    FallbackToolParser.defaultLaneId = laneId
  }

  static parse(text: string): { type: 'tool_calls'; data: ToolCallRequest[] } | { type: 'draft'; data: CardDraft[] } | { type: 'none'; data: [] } {
    const toolCalls = this.extractToolCalls(text)
    if (toolCalls.length > 0) return { type: 'tool_calls', data: toolCalls }

    const drafts = this.defaultLaneId ? this.extractCardDrafts(text) : []
    if (drafts.length > 0) return { type: 'draft', data: drafts }

    return { type: 'none', data: [] }
  }

  private static extractToolCalls(text: string): ToolCallRequest[] {
    const direct = this.tryParseToolCalls(text)
    if (direct.length > 0) return direct

    const fenced = this.tryParseToolCallsFromCodeBlock(text)
    if (fenced.length > 0) return fenced

    const embedded = this.tryParseToolCallsFromEmbeddedObject(text)
    if (embedded.length > 0) return embedded

    return []
  }

  private static tryParseToolCalls(text: string): ToolCallRequest[] {
    try {
      const parsed = JSON.parse(text.trim()) as unknown
      return this.normalizeToolCalls(parsed)
    } catch {
      return []
    }
  }

  private static tryParseToolCallsFromCodeBlock(text: string): ToolCallRequest[] {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (!match?.[1]) return []
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown
      return this.normalizeToolCalls(parsed)
    } catch {
      return []
    }
  }

  private static tryParseToolCallsFromEmbeddedObject(text: string): ToolCallRequest[] {
    const trimmed = text.trim()
    const startIndex = trimmed.indexOf('{')
    if (startIndex === -1) return []

    const slice = this.extractBalancedObjectSlice(trimmed, startIndex)
    if (!slice) return []

    try {
      const parsed = JSON.parse(slice) as unknown
      return this.normalizeToolCalls(parsed)
    } catch {
      return []
    }
  }

  private static normalizeToolCalls(parsed: unknown): ToolCallRequest[] {
    if (!parsed || typeof parsed !== 'object') return []
    const obj = parsed as Record<string, unknown>
    const calls = (obj.tool_calls ?? obj.toolCalls) as unknown
    if (!Array.isArray(calls)) return []
    return calls.filter((c) => this.isValidToolCall(c)) as ToolCallRequest[]
  }

  private static isValidToolCall(call: unknown): boolean {
    if (!call || typeof call !== 'object') return false
    const obj = call as Record<string, unknown>
    return typeof obj.toolName === 'string' && obj.params !== null && typeof obj.params === 'object'
  }

  private static extractBalancedObjectSlice(text: string, startIndex: number): string | null {
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

      if (ch === '{') depth++
      if (ch === '}') {
        depth--
        if (depth === 0) return text.slice(startIndex, i + 1)
      }
    }

    return null
  }

  private static extractCardDrafts(text: string): CardDraft[] {
    const lines = text.split(/\r?\n/)
    const drafts: Array<{ title: string; description?: string }> = []

    let pendingTitle: string | null = null
    let pendingDescriptionLines: string[] = []

    const flush = () => {
      if (!pendingTitle) return
      const title = pendingTitle.trim()
      const description = pendingDescriptionLines.join('\n').trim()
      if (title) drafts.push({ title, description: description || undefined })
      pendingTitle = null
      pendingDescriptionLines = []
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const titleLine = /^(?:\d+[\.\)\）]\s*)?(?:标题|title)\s*[:：]\s*(.+)$/i.exec(trimmed)
      if (titleLine) {
        flush()
        pendingTitle = titleLine[1] ?? ''
        continue
      }

      const descLine = /^(?:描述|description)\s*[:：]\s*(.+)$/i.exec(trimmed)
      if (descLine && pendingTitle) {
        pendingDescriptionLines.push(descLine[1] ?? '')
        continue
      }

      const match1 = /^创建(?:一张)?(?:卡片)?[:：]\s*(.+)$/i.exec(trimmed)
      if (match1) {
        flush()
        drafts.push({ title: match1[1].trim() })
        continue
      }

      const match3 = /^(?:待办|TODO)[:：]\s*(.+)$/i.exec(trimmed)
      if (match3) {
        flush()
        drafts.push({ title: match3[1].trim() })
        continue
      }

      const match4 = /^在\s*(.+?)\s*列表(?:里|中)?(?:创建|添加)?[:：]\s*(.+)$/i.exec(trimmed)
      if (match4) {
        flush()
        drafts.push({ title: (match4[2] ?? match4[1] ?? '').trim() })
        continue
      }

      const tableHeader = trimmed.match(/^\|?\s*(?:标题|title)\s*\|\s*(?:描述|description)\s*\|/i)
      if (tableHeader) {
        continue
      }

      if (pendingTitle) {
        pendingDescriptionLines.push(trimmed)
        continue
      }

      if (trimmed.length < 100 && !/[:：]/.test(trimmed)) {
        const potentialTitles = trimmed.split(/[，、；。]/)
        for (const t of potentialTitles) {
          const cleanTitle = t.trim()
          if (cleanTitle.length > 1 && cleanTitle.length < 50) {
            drafts.push({ title: cleanTitle })
          }
        }
      }
    }

    flush()

    return drafts
      .map((d) => ({
        laneId: FallbackToolParser.defaultLaneId,
        title: d.title,
        description: d.description,
      }))
      .filter((d) => d.laneId && d.title.trim().length > 0)
  }
}
