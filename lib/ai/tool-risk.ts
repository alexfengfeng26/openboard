import type { ToolCallRequest } from '@/types/ai-tools.types'

export type ToolRiskLevel = 'low' | 'medium' | 'high'

/**
 * 获取单个工具的风险等级
 */
export function getToolRiskLevel(toolName: string): ToolRiskLevel {
  const lowRiskTools = new Set(['create_card', 'create_lane', 'add_tag_to_card', 'remove_tag_from_card', 'copy_card', 'search_cards', 'reorder_cards', 'reorder_lanes'])
  const mediumRiskTools = new Set(['update_card', 'move_card', 'batch_update_cards'])
  const highRiskTools = new Set(['delete_card', 'delete_lane', 'delete_board'])

  if (lowRiskTools.has(toolName)) return 'low'
  if (mediumRiskTools.has(toolName)) return 'medium'
  if (highRiskTools.has(toolName)) return 'high'
  return 'medium' // 未知工具默认中风险
}

/**
 * 判断一批工具调用是否需要确认
 * @param toolCalls 工具调用列表
 * @param trustMode 信任模式
 * @returns 需要确认的工具调用（空数组表示全部自动执行）
 */
export function filterToolsNeedConfirm(
  toolCalls: ToolCallRequest[],
  trustMode: 'confirm_all' | 'confirm_high_risk' | 'auto_execute'
): ToolCallRequest[] {
  if (trustMode === 'confirm_all') {
    return toolCalls
  }
  if (trustMode === 'auto_execute') {
    // 高风险操作始终需要确认，即使自动执行模式
    return toolCalls.filter((c) => getToolRiskLevel(c.toolName) === 'high')
  }
  // confirm_high_risk: 中高风险需要确认
  return toolCalls.filter((c) => {
    const level = getToolRiskLevel(c.toolName)
    return level === 'high' || level === 'medium'
  })
}

/**
 * 判断一批工具调用是否可以完全自动执行
 */
export function canAutoExecute(
  toolCalls: ToolCallRequest[],
  trustMode: 'confirm_all' | 'confirm_high_risk' | 'auto_execute'
): boolean {
  return filterToolsNeedConfirm(toolCalls, trustMode).length === 0
}

/**
 * 获取工具调用的风险摘要
 */
export function getToolRiskSummary(toolCalls: ToolCallRequest[]): string {
  const counts = new Map<ToolRiskLevel, number>()
  for (const call of toolCalls) {
    const level = getToolRiskLevel(call.toolName)
    counts.set(level, (counts.get(level) || 0) + 1)
  }
  const parts: string[] = []
  const high = counts.get('high') || 0
  const medium = counts.get('medium') || 0
  const low = counts.get('low') || 0
  if (high > 0) parts.push(`高风险 ${high} 个`)
  if (medium > 0) parts.push(`中风险 ${medium} 个`)
  if (low > 0) parts.push(`低风险 ${low} 个`)
  return parts.join('，')
}
