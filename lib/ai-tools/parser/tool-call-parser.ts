import type { ToolCallRequest } from '@/types/ai-tools.types'

/**
 * 工具调用解析器 - 从 AI 返回的内容中解析工具调用
 */
export class ToolCallParser {
  /**
   * 解析 AI 返回的工具调用
   */
  static parse(aiResponse: string): ToolCallRequest[] | null {
    try {
      // 尝试直接解析 JSON
      const directParsed = this.tryParseJson(aiResponse)
      if (directParsed) return directParsed

      // 尝试提取代码块中的 JSON
      const codeBlockParsed = this.tryParseCodeBlock(aiResponse)
      if (codeBlockParsed) return codeBlockParsed

      // 尝试从文本中提取第一个 JSON 对象
      const embeddedParsed = this.tryParseEmbeddedObject(aiResponse)
      if (embeddedParsed) return embeddedParsed

      return null
    } catch (error) {
      console.error('[ToolCallParser] 解析失败:', error)
      return null
    }
  }

  /**
   * 尝试直接解析 JSON
   */
  private static tryParseJson(text: string): ToolCallRequest[] | null {
    try {
      const trimmed = text.trim()
      const parsed = JSON.parse(trimmed) as unknown

      return this.validateAndNormalize(parsed)
    } catch {
      return null
    }
  }

  /**
   * 尝试解析代码块中的 JSON
   */
  private static tryParseCodeBlock(text: string): ToolCallRequest[] | null {
    const patterns = [
      /```(?:json)?\s*([\s\S]*?)```/i,
      /```\s*([\s\S]*?)```/i,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1]) {
        try {
          const parsed = JSON.parse(match[1].trim()) as unknown
          const result = this.validateAndNormalize(parsed)
          if (result) return result
        } catch {
          continue
        }
      }
    }

    return null
  }

  /**
   * 验证并标准化解析结果
   */
  private static validateAndNormalize(parsed: unknown): ToolCallRequest[] | null {
    // 格式: { tool_calls: ToolCallRequest[] } 或 { toolCalls: ToolCallRequest[] }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      if ('tool_calls' in obj && Array.isArray(obj.tool_calls)) {
        const calls = obj.tool_calls as unknown[]
        if (calls.every(c => this.isValidToolCall(c))) {
          return calls as ToolCallRequest[]
        }
      }

      if ('toolCalls' in obj && Array.isArray(obj.toolCalls)) {
        const calls = obj.toolCalls as unknown[]
        if (calls.every(c => this.isValidToolCall(c))) {
          return calls as ToolCallRequest[]
        }
      }
    }

    return null
  }

  private static tryParseEmbeddedObject(text: string): ToolCallRequest[] | null {
    const trimmed = text.trim()
    const startIndex = trimmed.indexOf('{')
    if (startIndex === -1) return null

    const slice = this.extractBalancedObjectSlice(trimmed, startIndex)
    if (!slice) return null

    try {
      const parsed = JSON.parse(slice) as unknown
      return this.validateAndNormalize(parsed)
    } catch {
      return null
    }
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

  /**
   * 验证单个工具调用格式
   */
  private static isValidToolCall(call: unknown): boolean {
    if (!call || typeof call !== 'object') return false
    const obj = call as Record<string, unknown>
    return (
      typeof obj.toolName === 'string' &&
      obj.params !== null &&
      typeof obj.params === 'object'
    )
  }
}
