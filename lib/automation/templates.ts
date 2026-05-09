/**
 * 预设规则模板
 * 用户可以快速选择常用自动化规则
 */

import type { RuleTemplate } from '@/types/automation.types'

export const PRESET_TEMPLATES: RuleTemplate[] = [
  {
    name: '归档旧卡片',
    description: '当卡片在"已完成"列表中超过 7 天时自动归档',
    trigger: {
      type: 'scheduled',
      conditions: [
        { field: 'lane.title', operator: 'contains', value: '已完成' },
      ],
    },
    actions: [
      { type: 'archive_card', params: {} },
    ],
  },
  {
    name: '移动时自动打标签',
    description: '卡片移动到"测试"列表时自动添加"待测试"标签',
    trigger: {
      type: 'card_moved',
      conditions: [
        { field: 'toLaneId', operator: 'eq', value: 'testing' },
      ],
    },
    actions: [
      {
        type: 'add_tag',
        params: { tagId: 'testing' },
      },
    ],
  },
  {
    name: '移动到完成移除标签',
    description: '卡片移动到"已完成"时移除"进行中"标签',
    trigger: {
      type: 'card_moved',
      conditions: [
        { field: 'toLaneId', operator: 'eq', value: 'done' },
      ],
    },
    actions: [
      {
        type: 'remove_tag',
        params: { tagId: 'in-progress' },
      },
    ],
  },
  {
    name: '创建时自动分类',
    description: '新创建包含"Bug"关键字的卡片自动移动到"Bug 修复"列表',
    trigger: {
      type: 'card_created',
      conditions: [
        { field: 'card.title', operator: 'contains', value: 'Bug' },
      ],
    },
    actions: [
      {
        type: 'move_card',
        params: { targetLaneId: 'bug-fix' },
      },
      {
        type: 'add_tag',
        params: { tagId: 'bug' },
      },
    ],
  },
  {
    name: '列表过载通知',
    description: '当"待处理"列表超过 10 张卡片时发送通知',
    trigger: {
      type: 'lane_changed',
      conditions: [
        { field: 'lane.title', operator: 'contains', value: '待处理' },
      ],
    },
    actions: [
      {
        type: 'notify',
        params: { message: '"待处理"列表卡片数量过多，请优先处理' },
      },
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
