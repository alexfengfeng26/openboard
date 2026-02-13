/**
 * 应用设置类型定义
 */

import type { AiCommand } from './ai-commands.types'

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
 * 应用设置（根对象）
 */
export interface AppSettings {
  /** 版本号，用于迁移 */
  version: number
  /** AI 相关设置 */
  ai: AiSettings
  /** 看板显示设置 */
  boardView: BoardViewSettings
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
    updatedAt: now,
  }
}
