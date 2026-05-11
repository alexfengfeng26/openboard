import { BaseTool } from './base'
import type { ToolExecutionResult, ToolParameterSchema } from '@/types/ai-tools.types'

/**
 * 搜索卡片工具定义
 */
export class SearchCardsTool extends BaseTool {
  name = 'search_cards'
  description = '在当前看板中搜索卡片，返回匹配的卡片列表'
  category = 'card' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'boardId',
      type: 'string',
      required: true,
      description: '看板 ID'
    },
    {
      name: 'query',
      type: 'string',
      required: true,
      description: '搜索关键词或描述'
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
 * 批量更新卡片工具定义
 */
export class BatchUpdateCardsTool extends BaseTool {
  name = 'batch_update_cards'
  description = '批量更新多张卡片的标题、描述或标签'
  category = 'card' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'boardId',
      type: 'string',
      required: true,
      description: '看板 ID'
    },
    {
      name: 'cardIds',
      type: 'array',
      required: true,
      description: '要更新的卡片 ID 列表'
    },
    {
      name: 'title',
      type: 'string',
      required: false,
      description: '新标题（如提供则更新所有卡片标题）'
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
 * 批量更新卡片标签工具定义
 */
export class BatchUpdateCardTagsTool extends BaseTool {
  name = 'batch_update_card_tags'
  description = '批量为卡片添加或移除标签'
  category = 'card' as const
  paramSchema: ToolParameterSchema[] = [
    {
      name: 'boardId',
      type: 'string',
      required: true,
      description: '看板 ID'
    },
    {
      name: 'cardIds',
      type: 'array',
      required: true,
      description: '要更新标签的卡片 ID 列表'
    },
    {
      name: 'addTags',
      type: 'array',
      required: false,
      description: '要添加的标签列表'
    },
    {
      name: 'removeTagIds',
      type: 'array',
      required: false,
      description: '要移除的标签 ID 列表'
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
 * 为卡片添加标签工具定义
 */
export class AddTagToCardTool extends BaseTool {
  name = 'add_tag_to_card'
  description = '为指定卡片添加一个标签'
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
      name: 'tagName',
      type: 'string',
      required: true,
      description: '标签名称（如"紧急"、"功能"等）'
    },
    {
      name: 'tagColor',
      type: 'string',
      required: false,
      description: '标签颜色（十六进制，如 #ef4444）'
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
 * 移除卡片标签工具定义
 */
export class RemoveTagFromCardTool extends BaseTool {
  name = 'remove_tag_from_card'
  description = '从指定卡片移除一个标签'
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
      name: 'tagName',
      type: 'string',
      required: true,
      description: '要移除的标签名称'
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
 * 复制卡片工具定义
 */
export class CopyCardTool extends BaseTool {
  name = 'copy_card'
  description = '复制一张卡片到指定列表（不指定则复制到原列表）'
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
      description: '要复制的卡片 ID'
    },
    {
      name: 'targetLaneId',
      type: 'string',
      required: false,
      description: '目标列表 ID（不填则复制到同一列表）'
    },
    {
      name: 'count',
      type: 'number',
      required: false,
      description: '复制份数（默认 1）'
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
