import { dbHelpers } from '@/lib/db'
import { toolRegistry } from './tools/registry'
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
      // 1. 从注册表获取工具定义（用于验证和元数据）
      const tool = toolRegistry.get(toolName)
      if (!tool) {
        return {
          success: false,
          toolName,
          params,
          error: `Unknown tool: ${toolName}`,
          timestamp: new Date().toISOString()
        }
      }

      // 2. 参数验证
      const validation = tool.validateParams(params)
      if (!validation.valid) {
        return {
          success: false,
          toolName,
          params,
          error: validation.error || '参数验证失败',
          timestamp: new Date().toISOString()
        }
      }

      // 3. 执行（通过私有方法分发，保留原有 switch-case 逻辑）
      return await this.executeTool(toolName, params)
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

  /**
   * 实际工具执行分发（保留 switch-case，但已通过 registry 验证）
   */
  private static async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolExecutionResult> {
    switch (toolName) {
      // ===== 卡片查询操作 =====
      case 'search_cards': {
        const { boardId, query } = params as { boardId: string; query: string }
        const board = await dbHelpers.getBoard(boardId)
        if (!board) {
          return {
            success: false,
            toolName,
            params,
            error: `看板 ${boardId} 不存在`,
            timestamp: new Date().toISOString()
          }
        }
        const searchTerm = query.toLowerCase().trim()
        const results: Array<{ id: string; title: string; description?: string; laneTitle: string }> = []
        for (const lane of board.lanes) {
          for (const card of lane.cards) {
            const titleMatch = card.title.toLowerCase().includes(searchTerm)
            const descMatch = card.description?.toLowerCase().includes(searchTerm) ?? false
            const tagMatch = card.tags?.some((t) => t.name.toLowerCase().includes(searchTerm)) ?? false
            if (titleMatch || descMatch || tagMatch) {
              results.push({ id: card.id, title: card.title, description: card.description, laneTitle: lane.title })
            }
          }
        }
        return {
          success: true,
          toolName,
          params,
          result: { count: results.length, cards: results },
          timestamp: new Date().toISOString()
        }
      }

      // ===== 卡片批量操作 =====
      case 'batch_update_cards': {
        const { boardId, cardIds, title, description } = params as {
          boardId: string
          cardIds: string[]
          title?: string
          description?: string
        }
        const updateData: { title?: string; description?: string } = {}
        if (title !== undefined) updateData.title = title
        if (description !== undefined) updateData.description = description

        let successCount = 0
        let failCount = 0
        for (const cardId of cardIds) {
          try {
            await dbHelpers.updateCard(boardId, cardId, updateData)
            successCount++
          } catch {
            failCount++
          }
        }
        return {
          success: failCount === 0,
          toolName,
          params,
          result: { updated: successCount, failed: failCount },
          error: failCount > 0 ? `${failCount} 张卡片更新失败` : undefined,
          timestamp: new Date().toISOString()
        }
      }

      case 'batch_update_card_tags': {
        const { boardId, cardIds, addTags = [], removeTagIds = [] } = params as {
          boardId: string
          cardIds: string[]
          addTags?: import('@/types').Tag[]
          removeTagIds?: string[]
        }
        await dbHelpers.batchUpdateCardTags(boardId, cardIds, addTags, removeTagIds)
        return {
          success: true,
          toolName,
          params,
          result: { updated: cardIds.length, added: addTags.length, removed: removeTagIds.length },
          timestamp: new Date().toISOString()
        }
      }

      case 'add_tag_to_card': {
        const { boardId, cardId, tagName, tagColor } = params as {
          boardId: string
          cardId: string
          tagName: string
          tagColor?: string
        }
        const board = await dbHelpers.getBoard(boardId)
        if (!board) {
          return { success: false, toolName, params, error: `看板 ${boardId} 不存在`, timestamp: new Date().toISOString() }
        }
        let card: import('@/types').Card | undefined
        for (const lane of board.lanes) {
          card = lane.cards.find((c) => c.id === cardId)
          if (card) break
        }
        if (!card) {
          return { success: false, toolName, params, error: `卡片 ${cardId} 不存在`, timestamp: new Date().toISOString() }
        }
        const globalTags = await dbHelpers.getTags()
        let tag = globalTags.find((t) => t.name === tagName)
        if (!tag) {
          tag = { id: `tag-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: tagName, color: tagColor || '#6b7280' }
        }
        const currentTags = card.tags || []
        if (currentTags.some((t) => t.name === tagName)) {
          return { success: true, toolName, params, result: { cardId, tagName, alreadyExists: true }, timestamp: new Date().toISOString() }
        }
        await dbHelpers.updateCard(boardId, cardId, { tags: [...currentTags, tag] })
        return {
          success: true,
          toolName,
          params,
          result: { cardId, tagName, tagId: tag.id },
          timestamp: new Date().toISOString()
        }
      }

      case 'remove_tag_from_card': {
        const { boardId, cardId, tagName } = params as {
          boardId: string
          cardId: string
          tagName: string
        }
        const board = await dbHelpers.getBoard(boardId)
        if (!board) {
          return { success: false, toolName, params, error: `看板 ${boardId} 不存在`, timestamp: new Date().toISOString() }
        }
        let card: import('@/types').Card | undefined
        for (const lane of board.lanes) {
          card = lane.cards.find((c) => c.id === cardId)
          if (card) break
        }
        if (!card) {
          return { success: false, toolName, params, error: `卡片 ${cardId} 不存在`, timestamp: new Date().toISOString() }
        }
        const currentTags = card.tags || []
        const newTags = currentTags.filter((t) => t.name !== tagName)
        if (newTags.length === currentTags.length) {
          return { success: true, toolName, params, result: { cardId, tagName, notFound: true }, timestamp: new Date().toISOString() }
        }
        await dbHelpers.updateCard(boardId, cardId, { tags: newTags })
        return {
          success: true,
          toolName,
          params,
          result: { cardId, tagName, removed: true },
          timestamp: new Date().toISOString()
        }
      }

      case 'copy_card': {
        const { boardId, cardId, targetLaneId, count = 1 } = params as {
          boardId: string
          cardId: string
          targetLaneId?: string
          count?: number
        }
        const board = await dbHelpers.getBoard(boardId)
        if (!board) {
          return { success: false, toolName, params, error: `看板 ${boardId} 不存在`, timestamp: new Date().toISOString() }
        }
        let sourceCard: import('@/types').Card | undefined
        for (const lane of board.lanes) {
          sourceCard = lane.cards.find((c) => c.id === cardId)
          if (sourceCard) break
        }
        if (!sourceCard) {
          return { success: false, toolName, params, error: `卡片 ${cardId} 不存在`, timestamp: new Date().toISOString() }
        }
        const toLaneId = targetLaneId || sourceCard.laneId
        const copiedIds: string[] = []
        for (let i = 0; i < Math.min(count, 10); i++) {
          const newCard = await dbHelpers.createCard(
            boardId,
            toLaneId,
            `${sourceCard.title}${count > 1 ? ` (复制${i + 1})` : ' (复制)'}`,
            sourceCard.description,
            sourceCard.tags,
            sourceCard.attachments
          )
          copiedIds.push(newCard.id)
        }
        return {
          success: true,
          toolName,
          params,
          result: { originalCardId: cardId, copiedIds, targetLaneId: toLaneId },
          timestamp: new Date().toISOString()
        }
      }

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
  }
}
