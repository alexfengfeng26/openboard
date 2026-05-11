/**
 * AI 规则解析器
 * 使用 DeepSeek API 将自然语言转换为自动化规则
 */

import { z } from 'zod'
import type { AutomationRule } from '@/types/automation.types'
import { PRESET_TEMPLATES } from './templates'

const TriggerTypeSchema = z.enum([
  'card_moved',
  'card_created',
  'card_updated',
  'card_deleted',
  'lane_changed',
  'scheduled',
])

const OperatorSchema = z.enum([
  'eq',
  'ne',
  'gt',
  'lt',
  'gte',
  'lte',
  'contains',
  'not_contains',
])

const ActionTypeSchema = z.enum([
  'move_card',
  'add_tag',
  'remove_tag',
  'update_card',
  'archive_card',
  'notify',
  'auto_tag',
])

const RuleSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  enabled: z.boolean().default(true),
  trigger: z.object({
    type: TriggerTypeSchema,
    conditions: z.array(
      z.object({
        field: z.string(),
        operator: OperatorSchema,
        value: z.unknown(),
      })
    ),
  }),
  actions: z.array(
    z.object({
      type: ActionTypeSchema,
      params: z.record(z.string(), z.unknown()),
    })
  ),
})

const AIResponseSchema = z.object({
  rule: RuleSchema.optional(),
  matchedTemplate: z.string().optional(),
  explanation: z.string().optional(),
  error: z.string().optional(),
})

/**
 * 构建解析规则用的系统提示词
 */
function buildSystemPrompt(): string {
  return `你是一个看板自动化规则解析助手。用户的任务是：将自然语言描述转换为结构化的自动化规则。

## 可用触发器类型
- card_moved: 卡片被移动
- card_created: 卡片被创建
- card_updated: 卡片被更新
- card_deleted: 卡片被删除
- lane_changed: 列表变更（卡片数量变化）
- scheduled: 定时触发

## 可用条件操作符
- eq: 等于
- ne: 不等于
- gt: 大于
- lt: 小于
- gte: 大于等于
- lte: 小于等于
- contains: 包含
- not_contains: 不包含

## 可用条件字段
- card.title: 卡片标题
- card.id: 卡片ID
- lane.title: 列表标题
- lane.id: 列表ID
- fromLaneId: 来源列表ID（仅 card_moved）
- toLaneId: 目标列表ID（仅 card_moved）
- boardId: 看板ID

## 可用动作类型
- move_card: 移动卡片 (params: { targetLaneId: string, position?: number })，只有用户明确给出真实列表 ID 时使用
- add_tag: 添加标签 (params: { tagId: string })，只有用户明确给出真实标签 ID 时使用
- remove_tag: 移除标签 (params: { tagId: string })，只有用户明确给出真实标签 ID 时使用
- update_card: 更新卡片 (params: 任意字段)
- archive_card: 归档卡片 (params: {})
- notify: 发送通知 (params: { message: string })
- auto_tag: 智能标签匹配 (params: {}) — 自动根据卡片标题和描述内容匹配看板现有标签并添加

## 重要限制
- 如果用户说“自动打标签”“自动分类”“根据内容加标签”，优先生成 auto_tag，不要生成 add_tag。
- 不允许使用 testing、done、bug、in-progress 这类占位 ID。
- 如果缺少真实列表 ID 或标签 ID，不要生成 move_card/add_tag/remove_tag，改用 auto_tag 或 notify。

## 预设模板
${PRESET_TEMPLATES.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

## 输出格式
返回纯 JSON，格式如下：
{
  "rule": {
    "name": "规则名称",
    "description": "规则描述",
    "enabled": true,
    "trigger": { "type": "...", "conditions": [...] },
    "actions": [{ "type": "...", "params": {...} }]
  },
  "matchedTemplate": "匹配的预设模板名称（如果有）",
  "explanation": "对规则的解释说明"
}`
}

/**
 * 使用 AI 解析自然语言规则
 */
export async function parseRuleWithAI(
  description: string,
  boardId?: string
): Promise<{
  rule?: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>
  matchedTemplate?: string
  explanation?: string
  error?: string
}> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return { error: '未配置 DEEPSEEK_API_KEY' }
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          {
            role: 'user',
            content: `请解析以下自动化规则描述${boardId ? `（看板ID: ${boardId}）` : ''}：\n\n${description}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      return { error: `AI API 请求失败: ${response.status}` }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // 提取 JSON
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                      content.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content

    const parsed = JSON.parse(jsonStr)
    const validated = AIResponseSchema.safeParse(parsed)

    if (!validated.success) {
      return { error: `AI 返回格式无效: ${validated.error.message}` }
    }

    if (validated.data.error) {
      return { error: validated.data.error }
    }

    if (!validated.data.rule) {
      return { error: 'AI 未能生成规则' }
    }

    return {
      rule: {
        ...validated.data.rule,
        boardId,
      },
      matchedTemplate: validated.data.matchedTemplate,
      explanation: validated.data.explanation,
    }
  } catch (error) {
    return {
      error: `解析失败: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
