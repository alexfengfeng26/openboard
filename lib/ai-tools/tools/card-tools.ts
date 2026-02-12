import { BaseTool } from './base'
import type { ToolExecutionResult, ToolParameterSchema } from '@/types/ai-tools.types'

/**
 * 创建卡片工具定义
 */
export class CreateCardTool extends BaseTool {
  name = 'create_card'
  description = '在指定列表中创建新卡片'
  category = 'card' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'boardId',
      type: 'string',
      required: true,
      description: '看板 ID'
    },
    {
      name: 'laneId',
      type: 'string',
      required: true,
      description: '目标列表 ID'
    },
    {
      name: 'title',
      type: 'string',
      required: true,
      description: '卡片标题'
    },
    {
      name: 'description',
      type: 'string',
      required: false,
      description: '卡片详细描述'
    }
  ]

  async execute(): Promise<ToolExecutionResult> {
    return {
      success: false,
      toolName: this.name,
      params: {},
      error: 'Tool execution must be done on server side',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 更新卡片工具定义
 */
export class UpdateCardTool extends BaseTool {
  name = 'update_card'
  description = '更新现有卡片的标题、描述或移动到其他列表'
  category = 'card' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'boardId',
      type: 'string',
      required: true,
      description: '看板 ID'
    },
    {
      name: 'cardId',
      type: 'string',
      required: true,
      description: '卡片 ID'
    },
    {
      name: 'title',
      type: 'string',
      required: false,
      description: '新标题'
    },
    {
      name: 'description',
      type: 'string',
      required: false,
      description: '新描述'
    }
  ]

  async execute(): Promise<ToolExecutionResult> {
    return {
      success: false,
      toolName: this.name,
      params: {},
      error: 'Tool execution must be done on server side',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 移动卡片工具定义
 */
export class MoveCardTool extends BaseTool {
  name = 'move_card'
  description = '将卡片移动到另一个列表'
  category = 'card' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'boardId',
      type: 'string',
      required: true,
      description: '看板 ID'
    },
    {
      name: 'cardId',
      type: 'string',
      required: true,
      description: '要移动的卡片 ID'
    },
    {
      name: 'toLaneId',
      type: 'string',
      required: true,
      description: '目标列表 ID'
    }
  ]

  async execute(): Promise<ToolExecutionResult> {
    return {
      success: false,
      toolName: this.name,
      params: {},
      error: 'Tool execution must be done on server side',
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 删除卡片工具定义
 */
export class DeleteCardTool extends BaseTool {
  name = 'delete_card'
  description = '删除指定卡片（此操作不可撤销）'
  category = 'card' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'boardId',
      type: 'string',
      required: true,
      description: '看板 ID'
    },
    {
      name: 'cardId',
      type: 'string',
      required: true,
      description: '要删除的卡片 ID'
    }
  ]

  async execute(): Promise<ToolExecutionResult> {
    return {
      success: false,
      toolName: this.name,
      params: {},
      error: 'Tool execution must be done on server side',
      timestamp: new Date().toISOString()
    }
  }
}
