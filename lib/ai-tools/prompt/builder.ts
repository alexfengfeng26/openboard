import { toolRegistry } from '../tools/registry'
import type { PromptContext } from '@/types/ai-tools.types'

/**
 * Prompt 构建器 - 构建包含工具定义的系统提示词
 */
export class PromptBuilder {
  /**
   * 构建工具调用系统提示词
   */
  static buildToolSystemPrompt(context: PromptContext): string {
    const tools = toolRegistry.getAll()
    const toolDescriptions = tools.map(t => t.getPromptDescription()).join('\n\n')

    const contextInfo = this.buildContextInfo(context)

    return `
你是一个看板管理助手，可以帮助用户操作看板、列表和卡片。

## 当前上下文
${contextInfo}

## 可用工具
${toolDescriptions}

## 工具调用格式
当用户请求执行操作时，请按以下 JSON 格式返回工具调用：

\`\`\`json
{
  "tool_calls": [
    {
      "toolName": "工具名称",
      "params": {
        "参数名": "参数值"
      }
    }
  ]
}
\`\`\`

## 创建卡片指引
当用户要求创建卡片时，优先使用 create_card 工具，而非输出文本。工具参数：
- boardId: 当前看板 ID
- laneId: 目标列表 ID（用户指定的列表名称会自动转换）
- title: 卡片标题
- description: 卡片描述（可选）

用户可能使用的表达方式：
- "创建一张卡片：XXX"
- "新建卡片：XXX"
- "添加卡片：XXX"
- "待办：XXX"
- "在XXX列表创建：XXX"

## 重要规则
1. 只输出工具调用的 JSON，不要添加其他文字说明
2. 如果用户请求的操作无法用现有工具完成，请说明原因
3. 如果缺少必要信息（如列表 ID），请询问用户
4. 一次操作可以调用多个工具
5. 严格只执行用户请求的操作：不要创建未请求的新卡片，不要重复创建同名卡片
`.trim()
  }

  /**
   * 构建上下文信息
   */
  private static buildContextInfo(context: PromptContext): string {
    const parts: string[] = []

    if (context.currentBoard) {
      parts.push(`当前看板: ${context.currentBoard.title} (ID: ${context.currentBoard.id})`)
    }

    if (context.currentLanes && context.currentLanes.length > 0) {
      parts.push('当前列表:')
      context.currentLanes.forEach(lane => {
        parts.push(`  - ${lane.title} (ID: ${lane.id}, 卡片数: ${lane.cardCount})`)
        if (lane.cards && lane.cards.length > 0) {
          parts.push('    卡片:')
          lane.cards.slice(0, 50).forEach((card) => {
            parts.push(`      - ${card.title} (ID: ${card.id})`)
          })
        }
      })
    }

    return parts.length > 0 ? parts.join('\n') : '无上下文信息'
  }
}
