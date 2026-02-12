import { BaseTool } from './base'
import type { ToolExecutionResult, ToolParameterSchema } from '@/types/ai-tools.types'

/**
 * 创建列表工具定义
 */
export class CreateLaneTool extends BaseTool {
  name = 'create_lane'
  description = '在看板中创建新列表'
  category = 'lane' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'boardId',
      type: 'string',
      required: true,
      description: '看板 ID'
    },
    {
      name: 'title',
      type: 'string',
      required: true,
      description: '列表标题'
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
 * 更新列表工具定义
 */
export class UpdateLaneTool extends BaseTool {
  name = 'update_lane'
  description = '更新列表的标题或位置'
  category = 'lane' as const
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
      description: '列表 ID'
    },
    {
      name: 'title',
      type: 'string',
      required: false,
      description: '新标题'
    },
    {
      name: 'position',
      type: 'number',
      required: false,
      description: '新位置（数字）'
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
 * 删除列表工具定义
 */
export class DeleteLaneTool extends BaseTool {
  name = 'delete_lane'
  description = '删除指定列表及其所有卡片（此操作不可撤销）'
  category = 'lane' as const
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
      description: '要删除的列表 ID'
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
