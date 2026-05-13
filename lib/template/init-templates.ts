/**
 * 模板系统初始化
 * 首次启动时将旧系统的硬编码模板导入到新系统中，标记为 builtin
 */

import type { Template, TemplateDraft } from '@/types/template.types'
import { getTemplateManager } from './TemplateManager'

/**
 * 看板内置模板
 */
const BOARD_BUILTIN_TEMPLATES: Array<{ id: string; name: string; description: string; icon: string; lanes: { title: string; cards?: { title: string; description?: string }[] }[]; tags?: { id: string; name: string; color: string }[] }> = [
  {
    id: 'board-basic',
    name: '基础看板',
    description: '经典的待办/进行中/已完成三列看板，适合个人任务管理',
    icon: 'Layout',
    lanes: [
      { title: '待办' },
      { title: '进行中' },
      { title: '已完成' },
    ],
  },
  {
    id: 'board-scrum',
    name: 'Scrum Sprint',
    description: '敏捷开发 Sprint 看板，包含 Backlog 和 Review 环节',
    icon: 'Rocket',
    lanes: [
      { title: 'Backlog' },
      { title: 'Todo' },
      { title: 'In Progress' },
      { title: 'Review' },
      { title: 'Done' },
    ],
  },
  {
    id: 'board-content',
    name: '内容运营',
    description: '内容创作全流程管理，从选题到发布归档',
    icon: 'FileText',
    lanes: [
      { title: '选题池' },
      { title: '撰写中' },
      { title: '审核中' },
      { title: '已发布' },
      { title: '归档' },
    ],
  },
  {
    id: 'board-bug-track',
    name: 'Bug 跟踪',
    description: '缺陷管理专用看板，覆盖从提交到关闭的完整生命周期',
    icon: 'Bug',
    lanes: [
      { title: '新提交' },
      { title: '确认中' },
      { title: '修复中' },
      { title: '待验证' },
      { title: '已关闭' },
    ],
    tags: [
      { id: 'tag-critical', name: '严重', color: '#ef4444' },
      { id: 'tag-high', name: '高', color: '#f59e0b' },
      { id: 'tag-medium', name: '中', color: '#3b82f6' },
      { id: 'tag-low', name: '低', color: '#10b981' },
    ],
  },
  {
    id: 'board-project-mgmt',
    name: '项目管理',
    description: '通用项目管理流程，覆盖需求到上线的完整生命周期',
    icon: 'Briefcase',
    lanes: [
      { title: '需求分析' },
      { title: '设计' },
      { title: '开发' },
      { title: '测试' },
      { title: '上线' },
    ],
    tags: [
      { id: 'tag-p0', name: 'P0', color: '#ef4444' },
      { id: 'tag-p1', name: 'P1', color: '#f59e0b' },
      { id: 'tag-p2', name: 'P2', color: '#3b82f6' },
    ],
  },
  {
    id: 'board-product-design',
    name: '产品设计',
    description: '产品设计全流程，从需求调研到最终交付',
    icon: 'Palette',
    lanes: [
      { title: '需求调研' },
      { title: '原型设计' },
      { title: '视觉设计' },
      { title: '评审' },
      { title: '交付' },
    ],
    tags: [
      { id: 'tag-ux', name: 'UX', color: '#ec4899' },
      { id: 'tag-ui', name: 'UI', color: '#8b5cf6' },
    ],
  },
  {
    id: 'board-sales-funnel',
    name: '销售漏斗',
    description: '销售客户跟进流程，从潜在线索到最终成交',
    icon: 'TrendingUp',
    lanes: [
      { title: '潜在客户' },
      { title: '意向确认' },
      { title: '方案报价' },
      { title: '合同谈判' },
      { title: '成交' },
    ],
    tags: [
      { id: 'tag-hot', name: '热客', color: '#ef4444' },
      { id: 'tag-warm', name: '温客', color: '#f59e0b' },
      { id: 'tag-cold', name: '冷客', color: '#3b82f6' },
    ],
  },
  {
    id: 'board-recruitment',
    name: '招聘流程',
    description: '候选人招聘管理，从简历筛选到入职跟进',
    icon: 'Users',
    lanes: [
      { title: '简历筛选' },
      { title: '初面' },
      { title: '复面' },
      { title: 'Offer' },
      { title: '入职' },
    ],
    tags: [
      { id: 'tag-urgent', name: '急招', color: '#ef4444' },
      { id: 'tag-normal', name: '日常', color: '#3b82f6' },
    ],
  },
  {
    id: 'board-event-planning',
    name: '活动策划',
    description: '市场活动策划执行，从方案到复盘的全流程管理',
    icon: 'Calendar',
    lanes: [
      { title: '方案策划' },
      { title: '资源筹备' },
      { title: '执行中' },
      { title: '复盘总结' },
    ],
    tags: [
      { id: 'tag-online', name: '线上', color: '#8b5cf6' },
      { id: 'tag-offline', name: '线下', color: '#10b981' },
    ],
  },
  {
    id: 'board-study-plan',
    name: '学习计划',
    description: '个人学习进度跟踪，系统化知识积累管理',
    icon: 'BookOpen',
    lanes: [
      { title: '待学习' },
      { title: '学习中' },
      { title: '已掌握' },
      { title: '复习巩固' },
    ],
    tags: [
      { id: 'tag-tech', name: '技术', color: '#3b82f6' },
      { id: 'tag-soft', name: '软技能', color: '#ec4899' },
    ],
  },
  {
    id: 'board-family-tasks',
    name: '家庭事务',
    description: '家庭日常事务管理，购物、维修、安排一目了然',
    icon: 'Home',
    lanes: [
      { title: '待办事项' },
      { title: '采购中' },
      { title: '已完成' },
    ],
    tags: [
      { id: 'tag-shopping', name: '购物', color: '#f59e0b' },
      { id: 'tag-repair', name: '维修', color: '#ef4444' },
    ],
  },
  {
    id: 'board-personal-okr',
    name: '个人 OKR',
    description: '个人目标与关键结果管理，聚焦核心目标执行',
    icon: 'Target',
    lanes: [
      { title: '目标设定' },
      { title: '关键结果' },
      { title: '本周行动' },
      { title: '已完成' },
    ],
    tags: [
      { id: 'tag-goal', name: '目标', color: '#ef4444' },
      { id: 'tag-milestone', name: '里程碑', color: '#10b981' },
    ],
  },
]

/**
 * 卡片内置模板
 */
const CARD_BUILTIN_TEMPLATES: Array<{ id: string; name: string; description: string; icon: string; title: string; detail?: string; tags?: string[] }> = [
  {
    id: 'card-bug-report',
    name: 'Bug 报告',
    description: '标准 Bug 报告卡片模板',
    icon: 'Bug',
    title: '【Bug】',
    detail: '**问题描述**：\n\n**复现步骤**：\n1. \n2. \n3. \n\n**期望结果**：\n\n**实际结果**：\n\n**环境信息**：',
    tags: ['Bug'],
  },
  {
    id: 'card-feature-request',
    name: '需求申请',
    description: '新功能需求申请模板',
    icon: 'Lightbulb',
    title: '【需求】',
    detail: '**需求背景**：\n\n**功能描述**：\n\n**预期效果**：\n\n**优先级**：高/中/低',
    tags: ['功能'],
  },
]

/**
 * 自动化规则内置模板
 */
const AUTOMATION_BUILTIN_TEMPLATES: Array<{ id: string; name: string; description: string; icon: string; trigger: { type: 'card_created' | 'card_updated' | 'card_moved'; conditions: [] }; actions: { type: 'auto_tag'; params: Record<string, unknown> }[] }> = [
  {
    id: 'automation-auto-tag-create',
    name: '创建时自动匹配标签',
    description: '新创建卡片时，根据标题和描述内容自动匹配并添加现有标签',
    icon: 'Tag',
    trigger: { type: 'card_created', conditions: [] },
    actions: [{ type: 'auto_tag', params: {} }],
  },
  {
    id: 'automation-auto-tag-update',
    name: '更新时自动匹配标签',
    description: '卡片标题或描述更新后，根据内容自动补充现有标签',
    icon: 'Tag',
    trigger: { type: 'card_updated', conditions: [] },
    actions: [{ type: 'auto_tag', params: {} }],
  },
  {
    id: 'automation-auto-tag-move',
    name: '移动后自动匹配标签',
    description: '卡片移动到任意列表后，根据内容自动补充现有标签',
    icon: 'Tag',
    trigger: { type: 'card_moved', conditions: [] },
    actions: [{ type: 'auto_tag', params: {} }],
  },
]

/**
 * AI 提示词内置模板
 */
const PROMPT_BUILTIN_TEMPLATES: Array<{ id: string; name: string; description: string; icon: string; text: string; model?: 'deepseek-chat' | 'deepseek-reasoner'; autoSend?: boolean }> = [
  {
    id: 'prompt-daily-standup',
    name: '每日站会',
    description: '生成每日站会三张卡片：昨日完成 / 今日计划 / 阻塞项',
    icon: 'Users',
    text: '帮我生成每日站会的 3 张卡片：\n1. 昨日完成的工作\n2. 今日计划\n3. 当前的阻塞或风险\n每张卡片包含标题和简短描述。',
  },
  {
    id: 'prompt-sprint-planning',
    name: 'Sprint 规划',
    description: '生成本 Sprint 的规划卡片',
    icon: 'Rocket',
    text: '帮我生成本 Sprint 的规划卡片，包含：\n1. Sprint 目标\n2. 关键任务（3-5 张）\n3. 验收标准\n每张卡片给出标题和描述。',
  },
  {
    id: 'prompt-code-review',
    name: '代码审查',
    description: '生成代码审查相关的检查清单卡片',
    icon: 'Code',
    text: '帮我生成代码审查的检查清单卡片，包含：\n1. 代码规范性检查\n2. 逻辑正确性检查\n3. 性能影响评估\n4. 测试覆盖检查\n每张卡片给出标题和关键检查点。',
  },
]

/**
 * 将内置模板定义转换为 TemplateDraft
 */
function buildBoardTemplateDraft(def: typeof BOARD_BUILTIN_TEMPLATES[0]): TemplateDraft {
  return {
    meta: {
      type: 'board',
      name: def.name,
      description: def.description,
      tags: ['通用'],
      icon: def.icon,
      scope: 'global',
      builtin: true,
    },
    content: {
      lanes: def.lanes,
      tags: def.tags,
    },
  }
}

function buildCardTemplateDraft(def: typeof CARD_BUILTIN_TEMPLATES[0]): TemplateDraft {
  return {
    meta: {
      type: 'card',
      name: def.name,
      description: def.description,
      tags: ['开发'],
      icon: def.icon,
      scope: 'global',
      builtin: true,
    },
    content: {
      title: def.title,
      description: def.detail || def.description,
      tags: def.tags,
    },
  }
}

/**
 * 列表内置模板
 */
const LANE_BUILTIN_TEMPLATES: Array<{ id: string; name: string; description: string; icon: string; title: string; cards?: { title: string; description?: string }[] }> = [
  {
    id: 'lane-todo',
    name: '待办列表',
    description: '用于收集尚未开始的任务',
    icon: 'Layout',
    title: '待办',
  },
  {
    id: 'lane-doing',
    name: '进行中列表',
    description: '用于跟踪正在处理的任务',
    icon: 'Rocket',
    title: '进行中',
  },
  {
    id: 'lane-done',
    name: '已完成列表',
    description: '用于归档已完成的任务',
    icon: 'Check',
    title: '已完成',
  },
  {
    id: 'lane-backlog',
    name: 'Backlog',
    description: '用于沉淀待排期的需求和想法',
    icon: 'FileText',
    title: 'Backlog',
  },
  {
    id: 'lane-review',
    name: 'Review',
    description: '用于代码审查、内容审核或验收环节',
    icon: 'Bug',
    title: 'Review',
  },
]

function buildLaneTemplateDraft(def: typeof LANE_BUILTIN_TEMPLATES[0]): TemplateDraft {
  return {
    meta: {
      type: 'lane',
      name: def.name,
      description: def.description,
      tags: ['通用'],
      icon: def.icon,
      scope: 'global',
      builtin: true,
    },
    content: {
      title: def.title,
      cards: def.cards,
    },
  }
}

function buildAutomationTemplateDraft(def: typeof AUTOMATION_BUILTIN_TEMPLATES[0]): TemplateDraft {
  return {
    meta: {
      type: 'automation',
      name: def.name,
      description: def.description,
      tags: ['自动化'],
      icon: def.icon,
      scope: 'global',
      builtin: true,
    },
    content: {
      trigger: def.trigger,
      actions: def.actions,
    },
  }
}

function buildPromptTemplateDraft(def: typeof PROMPT_BUILTIN_TEMPLATES[0]): TemplateDraft {
  return {
    meta: {
      type: 'prompt',
      name: def.name,
      description: def.description,
      tags: ['AI'],
      icon: def.icon,
      scope: 'global',
      builtin: true,
    },
    content: {
      text: def.text,
      model: def.model,
      autoSend: def.autoSend,
    },
  }
}

/**
 * 初始化内置模板
 * 检查索引中是否已存在 builtin 模板，不存在则创建
 */
export async function initializeBuiltinTemplates(): Promise<{ created: number; skipped: number }> {
  const manager = await getTemplateManager()
  const result = { created: 0, skipped: 0 }

  const allTemplates = await manager.list()
  const existingBuiltinIds = new Set(
    allTemplates.filter((t) => t.meta.builtin).map((t) => t.meta.id)
  )

  const drafts: Array<{ id: string; draft: TemplateDraft }> = [
    ...BOARD_BUILTIN_TEMPLATES.map((d) => ({ id: d.id, draft: buildBoardTemplateDraft(d) })),
    ...CARD_BUILTIN_TEMPLATES.map((d) => ({ id: d.id, draft: buildCardTemplateDraft(d) })),
    ...LANE_BUILTIN_TEMPLATES.map((d) => ({ id: d.id, draft: buildLaneTemplateDraft(d) })),
    ...AUTOMATION_BUILTIN_TEMPLATES.map((d) => ({ id: d.id, draft: buildAutomationTemplateDraft(d) })),
    ...PROMPT_BUILTIN_TEMPLATES.map((d) => ({ id: d.id, draft: buildPromptTemplateDraft(d) })),
  ]

  for (const { id, draft } of drafts) {
    if (existingBuiltinIds.has(id)) {
      result.skipped++
      continue
    }

    // 直接写入，使用固定 ID
    const now = new Date().toISOString()
    const template: Template = {
      meta: {
        ...draft.meta,
        id,
        createdAt: now,
        updatedAt: now,
      },
      content: draft.content,
    }

    const { getTemplateStorage } = await import('@/lib/storage/TemplateStorage')
    const storage = await getTemplateStorage()
    await storage.write(template.meta.type, id, template)
    result.created++
  }

  // 重建索引
  if (result.created > 0) {
    await manager.rebuildIndex()
  }

  return result
}

/**
 * 检查模板系统是否已初始化
 */
export async function isTemplateSystemInitialized(): Promise<boolean> {
  try {
    const manager = await getTemplateManager()
    const templates = await manager.list()
    return templates.length > 0
  } catch {
    return false
  }
}
