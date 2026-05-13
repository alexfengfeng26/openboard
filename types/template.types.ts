/**
 * 模板系统统一类型定义
 */

import type { Tag } from './card.types'
import type { AutomationTrigger, AutomationAction } from './automation.types'

/** 模板类型 */
export type TemplateType = 'board' | 'card' | 'lane' | 'automation' | 'prompt'

/** 模板作用域 */
export type TemplateScope = 'global' | 'board'

/** 模板元数据 */
export interface TemplateMeta {
  id: string
  type: TemplateType
  name: string
  description?: string
  tags?: string[]
  icon?: string
  color?: string
  scope: TemplateScope
  boardId?: string
  builtin: boolean
  sourceId?: string
  createdAt: string
  updatedAt: string
}

/** 看板模板内容 */
export interface BoardTemplateContent {
  lanes: {
    title: string
    cards?: CardTemplateContent[]
  }[]
  tags?: Tag[]
}

/** 卡片模板内容 */
export interface CardTemplateContent {
  title: string
  description?: string
  tags?: string[]
  attachments?: {
    name: string
    type: string
  }[]
}

/** 列表模板内容 */
export interface LaneTemplateContent {
  title: string
  cards?: CardTemplateContent[]
}

/** 自动化规则模板内容 */
export interface AutomationTemplateContent {
  trigger: AutomationTrigger
  actions: AutomationAction[]
}

/** AI 提示词模板内容 */
export interface PromptTemplateContent {
  text: string
  variables?: string[]
  model?: 'deepseek-chat' | 'deepseek-reasoner'
  autoSend?: boolean
}

/** 各类型模板的具体数据内容 */
export type TemplateContent =
  | BoardTemplateContent
  | CardTemplateContent
  | LaneTemplateContent
  | AutomationTemplateContent
  | PromptTemplateContent

/** 完整模板 */
export interface Template {
  meta: TemplateMeta
  content: TemplateContent
}

/** 创建模板时的草稿 */
export type TemplateDraft = Omit<Template, 'meta'> & {
  meta: Omit<TemplateMeta, 'id' | 'createdAt' | 'updatedAt'>
}

/** 模板索引条目 */
export interface TemplateIndexEntry {
  id: string
  type: TemplateType
  name: string
  description?: string
  tags?: string[]
  icon?: string
  scope: TemplateScope
  boardId?: string
  builtin: boolean
  path: string
}

/** 模板索引 */
export interface TemplateIndex {
  version: number
  updatedAt: string
  templates: TemplateIndexEntry[]
}

/** 模板变量上下文 */
export interface TemplateVariableContext {
  board?: { id: string; title: string }
  lane?: { id: string; title: string }
  card?: { id: string; title: string }
  user?: { name?: string; id?: string }
  date?: { now: string; today: string; tomorrow: string }
}

/** 变量解析器 */
export interface VariableResolver {
  name: string
  description: string
  resolve: (context: TemplateVariableContext) => string | Promise<string>
}

/** 导出包 */
export interface ExportBundle {
  version: number
  exportedAt: string
  templates: Template[]
}

/** 导入结果 */
export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  overwritten: number
  errors: { templateName: string; reason: string }[]
}

/** 模板过滤条件 */
export interface TemplateFilter {
  type?: TemplateType
  scope?: TemplateScope
  boardId?: string
  tag?: string
  q?: string
}
