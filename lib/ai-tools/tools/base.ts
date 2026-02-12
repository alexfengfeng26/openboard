import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolParameterSchema
} from '@/types/ai-tools.types'

/**
 * 工具基类 - 所有工具继承此类
 */
export abstract class BaseTool implements ToolDefinition {
  abstract name: string
  abstract description: string
  abstract category: 'board' | 'lane' | 'card'
  abstract paramSchema: ToolParameterSchema[]

  /**
   * 执行工具 - 子类实现
   */
  abstract execute(params: Record<string, unknown>): Promise<ToolExecutionResult>

  /**
   * 生成工具描述（用于 Prompt）
   */
  getPromptDescription(): string {
    const params = this.paramSchema
      .map(p => {
        const required = p.required ? '[必填]' : '[可选]'
        const enumDesc = p.enum ? ` (可选值: ${p.enum.join(', ')})` : ''
        return `  - ${p.name}${required}: ${p.description}${enumDesc}`
      })
      .join('\n')

    return `
工具名: ${this.name}
描述: ${this.description}
参数:
${params}
`.trim()
  }

  /**
   * 验证参数
   */
  validateParams(params: Record<string, unknown>): { valid: boolean; error?: string } {
    for (const schema of this.paramSchema) {
      const value = params[schema.name]

      // 检查必填参数
      if (schema.required && value === undefined) {
        return { valid: false, error: `缺少必填参数: ${schema.name}` }
      }

      // 检查枚举值
      if (schema.enum && value !== undefined && !schema.enum.includes(String(value))) {
        return { valid: false, error: `参数 ${schema.name} 值无效，可选值: ${schema.enum.join(', ')}` }
      }

      // 类型检查
      if (value !== undefined) {
        const typeMap: Record<string, string> = {
          string: 'string',
          number: 'number',
          boolean: 'boolean',
          array: 'object',
          object: 'object'
        }
        const expectedType = typeMap[schema.type]
        if (typeof value !== expectedType) {
          return { valid: false, error: `参数 ${schema.name} 类型错误，期望 ${schema.type}，实际 ${typeof value}` }
        }
      }
    }

    return { valid: true }
  }
}
