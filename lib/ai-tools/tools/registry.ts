import type { BaseTool } from './base'
import { CreateCardTool, UpdateCardTool, MoveCardTool, DeleteCardTool } from './card-tools'
import { CreateLaneTool, DeleteLaneTool, UpdateLaneTool } from './lane-tools'
import { CreateBoardTool, DeleteBoardTool, UpdateBoardTool } from './board-tools'

/**
 * 工具注册表 - 单例模式
 */
class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map()

  constructor() {
    // 注册所有工具
    this.register(new CreateCardTool())
    this.register(new UpdateCardTool())
    this.register(new MoveCardTool())
    this.register(new DeleteCardTool())
    this.register(new CreateLaneTool())
    this.register(new DeleteLaneTool())
    this.register(new UpdateLaneTool())
    this.register(new CreateBoardTool())
    this.register(new DeleteBoardTool())
    this.register(new UpdateBoardTool())
  }

  private register(tool: BaseTool) {
    this.tools.set(tool.name, tool)
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name)
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values())
  }

  getByCategory(category: 'board' | 'lane' | 'card'): BaseTool[] {
    return this.getAll().filter(t => t.category === category)
  }
}

// 单例导出
export const toolRegistry = new ToolRegistry()
