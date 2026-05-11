/**
 * 预设规则模板
 * 用户可以快速选择常用自动化规则
 */

import type { RuleTemplate } from '@/types/automation.types'

export const PRESET_TEMPLATES: RuleTemplate[] = [
  {
    name: '创建时自动匹配标签',
    description: '新创建卡片时，根据标题和描述内容自动匹配并添加现有标签',
    trigger: {
      type: 'card_created',
      conditions: [],
    },
    actions: [
      { type: 'auto_tag', params: {} },
    ],
  },
  {
    name: '更新时自动匹配标签',
    description: '卡片标题或描述更新后，根据内容自动补充现有标签',
    trigger: {
      type: 'card_updated',
      conditions: [],
    },
    actions: [
      { type: 'auto_tag', params: {} },
    ],
  },
  {
    name: '移动后自动匹配标签',
    description: '卡片移动到任意列表后，根据内容自动补充现有标签',
    trigger: {
      type: 'card_moved',
      conditions: [],
    },
    actions: [
      { type: 'auto_tag', params: {} },
    ],
  },
]

/**
 * 获取预设模板
 */
export function getPresetTemplates(): RuleTemplate[] {
  return [...PRESET_TEMPLATES]
}

/**
 * 根据名称查找模板
 */
export function findTemplateByName(name: string): RuleTemplate | undefined {
  return PRESET_TEMPLATES.find((t) => t.name === name)
}
