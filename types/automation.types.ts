/**
 * AI 工作流自动化规则类型定义
 */

/** 触发器类型 */
export type AutomationTriggerType =
  | 'card_moved'
  | 'card_created'
  | 'card_updated'
  | 'card_deleted'
  | 'lane_changed'
  | 'scheduled'

/** 条件操作符 */
export type AutomationOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'not_contains'

/** 条件 */
export interface AutomationCondition {
  field: string
  operator: AutomationOperator
  value: unknown
}

/** 触发器 */
export interface AutomationTrigger {
  type: AutomationTriggerType
  conditions: AutomationCondition[]
}

/** 动作类型 */
export type AutomationActionType =
  | 'move_card'
  | 'add_tag'
  | 'remove_tag'
  | 'update_card'
  | 'archive_card'
  | 'notify'

/** 动作 */
export interface AutomationAction {
  type: AutomationActionType
  params: Record<string, unknown>
}

/** 自动化规则 */
export interface AutomationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: AutomationTrigger
  actions: AutomationAction[]
  createdAt: string
  updatedAt: string
  boardId?: string
}

/** 规则解析请求 */
export interface ParseRuleRequest {
  description: string
  boardId?: string
}

/** 规则解析响应 */
export interface ParseRuleResponse {
  success: boolean
  rule?: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>
  error?: string
}

/** 规则列表响应 */
export interface RulesResponse {
  success: boolean
  rules?: AutomationRule[]
  error?: string
}

/** 规则执行请求 */
export interface ExecuteRuleRequest {
  ruleId: string
  boardId: string
  cardId?: string
  laneId?: string
}

/** 触发事件上下文 */
export interface TriggerContext {
  boardId: string
  cardId?: string
  laneId?: string
  fromLaneId?: string
  toLaneId?: string
  cardTitle?: string
  laneTitle?: string
}

/** 预设规则模板 */
export interface RuleTemplate {
  name: string
  description: string
  trigger: AutomationTrigger
  actions: AutomationAction[]
}
