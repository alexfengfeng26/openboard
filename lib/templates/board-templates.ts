import type { Lane } from '@/types'

export interface BoardTemplate {
  id: string
  name: string
  description: string
  icon: string
  lanes: Pick<Lane, 'title'>[]
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'basic',
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
    id: 'scrum',
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
    id: 'content',
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
    id: 'bug-track',
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
  },
]

export function getTemplateById(id: string): BoardTemplate | undefined {
  return BOARD_TEMPLATES.find((t) => t.id === id)
}
