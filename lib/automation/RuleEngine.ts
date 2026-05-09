/**
 * 自动化规则引擎
 * 负责触发条件匹配和动作执行
 */

import type {
  AutomationRule,
  AutomationCondition,
  AutomationOperator,
  TriggerContext,
  AutomationAction,
  AutomationTriggerType,
} from '@/types/automation.types'
import { getStorage } from '@/lib/storage/StorageAdapter'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'

export class RuleEngineError extends Error {
  constructor(message: string, cause?: Error) {
    super(message)
    this.name = 'RuleEngineError'
    this.cause = cause
  }
}

/**
 * 评估条件
 */
function evaluateCondition(
  condition: AutomationCondition,
  context: TriggerContext
): boolean {
  // 根据条件字段从上下文中获取值
  let actualValue: unknown

  // 处理嵌套字段（如 card.title、lane.name）
  if (condition.field.startsWith('card.')) {
    const field = condition.field.replace('card.', '')
    actualValue = getFieldValue(field, context)
  } else if (condition.field.startsWith('lane.')) {
    const field = condition.field.replace('lane.', '')
    actualValue = getFieldValue(field, context)
  } else {
    actualValue = getFieldValue(condition.field, context)
  }

  return compare(actualValue, condition.operator, condition.value)
}

/**
 * 获取字段值
 */
function getFieldValue(field: string, context: TriggerContext): unknown {
  switch (field) {
    case 'id':
      return context.cardId || context.laneId || ''
    case 'title':
      return context.cardTitle || context.laneTitle || ''
    case 'boardId':
      return context.boardId
    case 'laneId':
      return context.laneId
    case 'fromLaneId':
      return context.fromLaneId
    case 'toLaneId':
      return context.toLaneId
    default:
      return undefined
  }
}

/**
 * 比较值
 */
function compare(actual: unknown, operator: AutomationOperator, expected: unknown): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected
    case 'ne':
      return actual !== expected
    case 'gt':
      if (typeof actual === 'number' && typeof expected === 'number') {
        return actual > expected
      }
      return false
    case 'lt':
      if (typeof actual === 'number' && typeof expected === 'number') {
        return actual < expected
      }
      return false
    case 'gte':
      if (typeof actual === 'number' && typeof expected === 'number') {
        return actual >= expected
      }
      return false
    case 'lte':
      if (typeof actual === 'number' && typeof expected === 'number') {
        return actual <= expected
      }
      return false
    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.includes(expected)
      }
      return false
    case 'not_contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return !actual.includes(expected)
      }
      return false
    default:
      return false
  }
}

/**
 * 辅助函数：从看板中获取卡片
 */
async function getCardFromBoard(boardId: string, cardId: string) {
  const storage = await getStorage()
  const board = await storage.getBoard(boardId)
  if (!board) return null
  return board.lanes.flatMap((l) => l.cards).find((c) => c.id === cardId) || null
}

/**
 * 执行动作
 */
async function executeAction(
  action: AutomationAction,
  context: TriggerContext
): Promise<void> {
  const storage = await getStorage()
  const { boardId, cardId } = context

  if (!boardId) {
    console.warn('[RuleEngine] 需要 boardId 才能执行动作')
    return
  }

  switch (action.type) {
    case 'move_card': {
      if (!cardId) {
        console.warn('[RuleEngine] move_card 需要 cardId')
        return
      }
      const { targetLaneId, position } = action.params as {
        targetLaneId: string
        position?: number
      }
      await storage.moveCard(boardId, cardId, targetLaneId, position ?? 0)
      console.log(`[RuleEngine] 移动卡片 ${cardId} 到列表 ${targetLaneId}`)
      break
    }

    case 'add_tag': {
      if (!cardId) {
        console.warn('[RuleEngine] add_tag 需要 cardId')
        return
      }
      const { tagId } = action.params as { tagId: string }
      const card = await getCardFromBoard(boardId, cardId)
      if (card) {
        const tags = card.tags || []
        if (!tags.some((t) => t.id === tagId)) {
          tags.push({ id: tagId, name: '', color: '' })
          await storage.updateCard(boardId, cardId, { tags })
          console.log(`[RuleEngine] 添加标签 ${tagId} 到卡片 ${cardId}`)
        }
      }
      break
    }

    case 'remove_tag': {
      if (!cardId) {
        console.warn('[RuleEngine] remove_tag 需要 cardId')
        return
      }
      const { tagId } = action.params as { tagId: string }
      const card = await getCardFromBoard(boardId, cardId)
      if (card) {
        const tags = (card.tags || []).filter((t) => t.id !== tagId)
        await storage.updateCard(boardId, cardId, { tags })
        console.log(`[RuleEngine] 移除标签 ${tagId} 从卡片 ${cardId}`)
      }
      break
    }

    case 'update_card': {
      if (!cardId) {
        console.warn('[RuleEngine] update_card 需要 cardId')
        return
      }
      const updates = action.params as Record<string, unknown>
      await storage.updateCard(boardId, cardId, updates as Parameters<typeof storage.updateCard>[2])
      console.log(`[RuleEngine] 更新卡片 ${cardId}`, updates)
      break
    }

    case 'archive_card': {
      if (!cardId) {
        console.warn('[RuleEngine] archive_card 需要 cardId')
        return
      }
      // 归档实现：尝试移动到"归档"或"已完成"列表
      const board = await storage.getBoard(boardId)
      const archiveLane = board?.lanes.find(
        (l) => l.title.includes('归档') || l.title.includes('已完成') || l.title.includes('Done')
      )
      if (archiveLane) {
        await storage.moveCard(boardId, cardId, archiveLane.id, 0)
        console.log(`[RuleEngine] 归档卡片 ${cardId} 到列表 ${archiveLane.title}`)
      } else {
        console.log(`[RuleEngine] 未找到归档列表，跳过归档卡片 ${cardId}`)
      }
      break
    }

    case 'notify': {
      const { message } = action.params as { message: string }
      console.log(`[RuleEngine] 通知: ${message}`)
      break
    }

    case 'auto_tag': {
      if (!cardId) {
        console.warn('[RuleEngine] auto_tag 需要 cardId')
        return
      }
      const card = await getCardFromBoard(boardId, cardId)
      if (!card) {
        console.warn(`[RuleEngine] 未找到卡片 ${cardId}`)
        return
      }

      const board = await storage.getBoard(boardId)
      if (!board) {
        console.warn(`[RuleEngine] 未找到看板 ${boardId}`)
        return
      }

      let boardTags = board.tags || []
      if (boardTags.length === 0) {
        // 看板没有标签时，回退到全局标签池
        const settingsStorage = await getSettingsStorage()
        const globalTags = await settingsStorage.getGlobalTags()
        if (globalTags.length === 0) {
          console.log('[RuleEngine] 看板和全局标签池均为空，跳过 auto_tag')
          return
        }
        boardTags = globalTags
        console.log(`[RuleEngine] 看板标签为空，使用全局标签池 (${globalTags.length} 个)`)
      }

      const searchText = ((card.title || '') + ' ' + (card.description || '')).toLowerCase()
      const currentTagIds = new Set((card.tags || []).map((t) => t.id))
      const matchedTags = boardTags.filter((tag) => {
        if (currentTagIds.has(tag.id)) return false
        const tagName = (tag.name || '').toLowerCase().trim()
        return tagName && searchText.includes(tagName)
      })

      if (matchedTags.length > 0) {
        const newTags = [...(card.tags || []), ...matchedTags]
        await storage.updateCard(boardId, cardId, { tags: newTags })
        console.log(`[RuleEngine] auto_tag 为卡片 ${cardId} 添加 ${matchedTags.length} 个标签: ${matchedTags.map((t) => t.name).join(', ')}`)
      } else {
        console.log(`[RuleEngine] auto_tag 未匹配到标签`)
      }
      break
    }

    default:
      console.warn(`[RuleEngine] 未知动作类型: ${(action as AutomationAction).type}`)
  }
}

/**
 * 规则引擎
 */
export class RuleEngine {
  /**
   * 评估规则是否匹配触发条件
   */
  static evaluateTrigger(
    rule: AutomationRule,
    triggerType: AutomationTriggerType,
    context: TriggerContext
  ): boolean {
    if (!rule.enabled) return false
    if (rule.trigger.type !== triggerType) return false

    // 检查 boardId 匹配
    if (rule.boardId && rule.boardId !== context.boardId) return false

    // 评估所有条件
    return rule.trigger.conditions.every((condition) =>
      evaluateCondition(condition, context)
    )
  }

  /**
   * 执行规则的动作
   */
  static async executeActions(
    rule: AutomationRule,
    context: TriggerContext
  ): Promise<{ success: boolean; executed: number; errors: string[] }> {
    const errors: string[] = []
    let executed = 0

    for (const action of rule.actions) {
      try {
        await executeAction(action, context)
        executed++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`动作 ${action.type} 失败: ${message}`)
        console.error(`[RuleEngine] 执行动作失败:`, error)
      }
    }

    return {
      success: errors.length === 0,
      executed,
      errors,
    }
  }

  /**
   * 运行所有匹配的规则
   */
  static async runRules(
    rules: AutomationRule[],
    triggerType: AutomationTriggerType,
    context: TriggerContext
  ): Promise<{ matched: number; executed: number; errors: string[] }> {
    const matchedRules = rules.filter((rule) =>
      this.evaluateTrigger(rule, triggerType, context)
    )

    let totalExecuted = 0
    const allErrors: string[] = []

    for (const rule of matchedRules) {
      const result = await this.executeActions(rule, context)
      totalExecuted += result.executed
      allErrors.push(...result.errors)
    }

    return {
      matched: matchedRules.length,
      executed: totalExecuted,
      errors: allErrors,
    }
  }
}
