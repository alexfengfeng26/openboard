import { BaseTool } from './base'
import type { ToolExecutionResult, ToolParameterSchema } from '@/types/ai-tools.types'

/**
 * 创建看板工具定义
 */
export class CreateBoardTool extends BaseTool {
  name = 'create_board'
  description = '创建新看板（包含默认的待办、进行中、已完成列表）'
  category = 'board' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'title',
      type: 'string',
      required: true,
      description: '看板标题'
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
 * 更新看板工具定义
 */
export class UpdateBoardTool extends BaseTool {
  name = 'update_board'
  description = '更新看板标题'
  category = 'board' as const
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
      description: '新标题'
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
 * 删除看板工具定义
 */
export class DeleteBoardTool extends BaseTool {
  name = 'delete_board'
  description = '删除指定看板（至少保留一个看板，此操作不可撤销）'
  category = 'board' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'boardId',
      type: 'string',
      required: true,
      description: '要删除的看板 ID'
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
