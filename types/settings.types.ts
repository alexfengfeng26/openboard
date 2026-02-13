/**
 * 应用设置类型定义
 */

import type { AiCommand } from './ai-commands.types'
import type { Tag } from './index'

/**
 * AI 工具触发配置
 */
export interface AiToolTriggerConfig {
  /** 是否通过前缀触发工具 */
  gateByPrefix: boolean
  /** 是否在聊天中显示快捷模板 */
  showQuickTemplatesInChat: boolean
  /** 是否在聊天中显示助手操作 */
  showAssistantActionsInChat: boolean
  /** 各范围触发前缀 */
  prefixes: {
    all: string
    card: string
    lane: string
    board: string
  }
}

/**
 * AI 设置
 */
export interface AiSettings {
  /** 默认使用的模型 */
  defaultModel: 'deepseek-chat' | 'deepseek-reasoner'
  /** 工具触发配置 */
  toolTrigger: AiToolTriggerConfig
  /** AI 命令/模板列表 */
  commands: AiCommand[]
}

/**
 * 看板显示设置
 */
export interface BoardViewSettings {
  /** 默认看板 ID */
  defaultBoardId?: string
  /** 卡片显示密度 */
  cardDensity: 'compact' | 'normal' | 'comfortable'
  /** 是否显示卡片描述预览 */
  showCardDescription: boolean
  /** 是否显示标签颜色 */
  showTagColors: boolean
}

/**
 * 标签配置设置
 */
export interface TagsSettings {
  /** 全局预设标签池 */
  globalTags: Tag[]
  /** 是否允许在看板中自定义标签 */
  allowCustomTags: boolean
  /** 默认标签颜色选项 */
  colorOptions: string[]
}

/**
 * 应用设置（根对象）
 */
export interface AppSettings {
  /** 版本号，用于迁移 */
  version: number
  /** AI 相关设置 */
  ai: AiSettings
  /** 看板显示设置 */
  boardView: BoardViewSettings
  /** 标签配置设置 */
  tags: TagsSettings
  /** 更新时间 */
  updatedAt: string
}

/**
 * 设置存储错误
 */
export class SettingsStorageError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'SettingsStorageError'
  }
}

/** 默认标签颜色选项 */
export const DEFAULT_TAG_COLORS = [
  '#ef4444', // 红色
  '#f97316', // 橙色
  '#f59e0b', // 琥珀色
  '#84cc16', // 黄绿色
  '#22c55e', // 绿色
  '#10b981', // 翠绿色
  '#14b8a6', // 青色
  '#06b6d4', // 天蓝色
  '#0ea5e9', // 蓝色
  '#3b82f6', // 亮蓝色
  '#6366f1', // 靛蓝色
  '#8b5cf6', // 紫色
  '#a855f7', // 紫罗兰
  '#d946ef', // 洋红色
  '#ec4899', // 粉色
  '#f43f5e', // 玫瑰色
  '#6b7280', // 灰色
  '#374151', // 深灰色
]

/**
 * 创建默认标签
 */
export function createDefaultTags(): Tag[] {
  return [
    { id: 'tag-urgent', name: '紧急', color: '#ef4444' },
    { id: 'tag-feature', name: '功能', color: '#3b82f6' },
    { id: 'tag-bug', name: 'Bug', color: '#f59e0b' },
    { id: 'tag-optimize', name: '优化', color: '#10b981' },
    { id: 'tag-docs', name: '文档', color: '#8b5cf6' },
    { id: 'tag-design', name: '设计', color: '#ec4899' },
  ]
}

/**
 * 默认设置
 */
export function createDefaultSettings(): AppSettings {
  const now = new Date().toISOString()
  
  return {
    version: 1,
    ai: {
      defaultModel: 'deepseek-chat',
      toolTrigger: {
        gateByPrefix: true,
        showQuickTemplatesInChat: false,
        showAssistantActionsInChat: true,
        prefixes: {
          all: '/kb',
          card: '/card',
          lane: '/lane',
          board: '/board',
        },
      },
      commands: [], // 默认命令在初始化时从 createDefaultAiCommands 填充
    },
    boardView: {
      cardDensity: 'normal',
      showCardDescription: true,
      showTagColors: true,
    },
    tags: {
      globalTags: createDefaultTags(),
      allowCustomTags: true,
      colorOptions: DEFAULT_TAG_COLORS,
    },
    updatedAt: now,
  }
}
