import { dbHelpers } from '@/lib/db'
import type { ToolCallRequest, ToolExecutionResult } from '@/types/ai-tools.types'

/**
 * 服务端工具执行器 - 处理所有工具的实际执行逻辑
 * 仅在服务端使用，避免打包 lowdb 到客户端
 */
export class ServerToolExecutor {
  /**
   * 执行工具调用
   */
  static async execute(toolCall: ToolCallRequest): Promise<ToolExecutionResult> {
    const { toolName, params } = toolCall

    try {
      switch (toolName) {
        // ===== 卡片操作 =====
        case 'create_card': {
          const { boardId, laneId, title, description } = params as {
            boardId: string
            laneId: string
            title: string
            description?: string
          }
          const card = await dbHelpers.createCard(boardId, laneId, title, description)
          return {
            success: true,
            toolName,
            params,
            result: { id: card.id, title: card.title, laneId: card.laneId },
            timestamp: new Date().toISOString()
          }
        }

        case 'update_card': {
          const { boardId, cardId, ...data } = params as {
            boardId: string
            cardId: string
            title?: string
            description?: string
          }
          await dbHelpers.updateCard(boardId, cardId, data)
          return {
            success: true,
            toolName,
            params,
            result: { id: cardId, updated: true },
            timestamp: new Date().toISOString()
          }
        }

        case 'move_card': {
          const { boardId, cardId, toLaneId } = params as {
            boardId: string
            cardId: string
            toLaneId: string
          }
          await dbHelpers.moveCard(boardId, cardId, toLaneId, 0)
          return {
            success: true,
            toolName,
            params,
            result: { cardId, toLaneId },
            timestamp: new Date().toISOString()
          }
        }

        case 'delete_card': {
          const { boardId, cardId } = params as {
            boardId: string
            cardId: string
          }
          await dbHelpers.deleteCard(boardId, cardId)
          return {
            success: true,
            toolName,
            params,
            result: { cardId, deleted: true },
            timestamp: new Date().toISOString()
          }
        }

        // ===== 列表操作 =====
        case 'create_lane': {
          const { boardId, title } = params as {
            boardId: string
            title: string
          }
          const lane = await dbHelpers.createLane(boardId, title)
          return {
            success: true,
            toolName,
            params,
            result: { id: lane.id, title: lane.title },
            timestamp: new Date().toISOString()
          }
        }

        case 'update_lane': {
          const { boardId, laneId, ...data } = params as {
            boardId: string
            laneId: string
            title?: string
            position?: number
          }
          await dbHelpers.updateLane(boardId, laneId, data)
          return {
            success: true,
            toolName,
            params,
            result: { id: laneId, updated: true },
            timestamp: new Date().toISOString()
          }
        }

        case 'delete_lane': {
          const { boardId, laneId } = params as {
            boardId: string
            laneId: string
          }
          await dbHelpers.deleteLane(boardId, laneId)
          return {
            success: true,
            toolName,
            params,
            result: { laneId, deleted: true },
            timestamp: new Date().toISOString()
          }
        }

        // ===== 看板操作 =====
        case 'create_board': {
          const { title } = params as { title: string }
          const board = await dbHelpers.createBoard(title)
          return {
            success: true,
            toolName,
            params,
            result: { id: board.id, title: board.title },
            timestamp: new Date().toISOString()
          }
        }

        case 'update_board': {
          const { boardId, title } = params as {
            boardId: string
            title: string
          }
          const result = await dbHelpers.updateBoard(boardId, { title })
          if (!result) {
            return {
              success: false,
              toolName,
              params,
              error: `看板 ${boardId} 不存在`,
              timestamp: new Date().toISOString()
            }
          }
          return {
            success: true,
            toolName,
            params,
            result: { id: boardId, title, updated: true },
            timestamp: new Date().toISOString()
          }
        }

        case 'delete_board': {
          const { boardId } = params as { boardId: string }
          const result = await dbHelpers.deleteBoard(boardId)
          if (!result) {
            return {
              success: false,
              toolName,
              params,
              error: `看板 ${boardId} 不存在或无法删除（至少保留一个看板）`,
              timestamp: new Date().toISOString()
            }
          }
          return {
            success: true,
            toolName,
            params,
            result: { boardId, deleted: true },
            timestamp: new Date().toISOString()
          }
        }

        default:
          return {
            success: false,
            toolName,
            params,
            error: `Unknown tool: ${toolName}`,
            timestamp: new Date().toISOString()
          }
      }
    } catch (error) {
      return {
        success: false,
        toolName,
        params,
        error: error instanceof Error ? error.message : '执行失败',
        timestamp: new Date().toISOString()
      }
    }
  }
}
