/**
 * 自动化规则触发器
 * 在卡片操作中调用，触发匹配的自动化规则
 */

import { getRuleStorage } from './RuleStorage'
import { RuleEngine } from './RuleEngine'
import { dbHelpers } from '@/lib/db'
import type { AutomationTriggerType, TriggerContext } from '@/types/automation.types'

/**
 * 触发自动化规则
 * 在卡片操作完成后异步调用，不阻塞主流程
 */
export async function triggerAutomation(
  triggerType: AutomationTriggerType,
  context: TriggerContext
): Promise<void> {
  try {
    const storage = await getRuleStorage()
    const rules = await storage.getAllRules(context.boardId)

    const result = await RuleEngine.runRules(rules, triggerType, context)

    if (result.matched > 0) {
      console.log(
        `[Automation] 触发 ${triggerType}: 匹配 ${result.matched} 条规则, 执行 ${result.executed} 个动作`
      )
      if (result.errors.length > 0) {
        console.error('[Automation] 执行错误:', result.errors)
      }

      await dbHelpers.addOperationLog(context.boardId, {
        id: `automation-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        status: result.errors.length === 0 ? 'executed' : 'failed',
        toolName: 'automation_rule',
        params: {
          triggerType,
          boardId: context.boardId,
          cardId: context.cardId,
          laneId: context.laneId,
          fromLaneId: context.fromLaneId,
          toLaneId: context.toLaneId,
        },
        result: {
          matched: result.matched,
          executed: result.executed,
          errors: result.errors,
        },
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        confirmedBy: 'auto',
      })
    }
  } catch (error) {
    // 自动化触发失败不应影响主流程
    console.error('[Automation] 触发失败:', error)
  }
}
