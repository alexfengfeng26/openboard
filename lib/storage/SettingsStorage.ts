/**
 * 应用设置存储服务
 * 使用 JSON 文件存储设置
 */

import { promises as fs } from 'fs'
import path from 'path'
import type { AppSettings, AiSettings, BoardViewSettings } from '@/types/settings.types'
import { createDefaultSettings, SettingsStorageError } from '@/types/settings.types'
import { createDefaultAiCommands, normalizeAiCommands } from '@/lib/ai/commands'

/**
 * 设置文件路径
 */
const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

/**
 * 设置存储类
 */
export class SettingsStorage {
  private static instance: SettingsStorage | null = null
  private settings: AppSettings | null = null
  private initialized = false

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): SettingsStorage {
    if (!SettingsStorage.instance) {
      SettingsStorage.instance = new SettingsStorage()
    }
    return SettingsStorage.instance
  }

  /**
   * 初始化设置存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 确保 data 目录存在
      const dataDir = path.dirname(SETTINGS_FILE)
      await fs.mkdir(dataDir, { recursive: true })

      // 尝试读取现有设置
      const settings = await this.loadFromFile()
      
      if (settings) {
        // 合并默认设置（处理新增字段）
        this.settings = this.mergeWithDefaults(settings)
      } else {
        // 创建默认设置
        this.settings = createDefaultSettings()
        // 初始化默认 AI 命令
        this.settings.ai.commands = createDefaultAiCommands()
        await this.saveToFile()
      }

      this.initialized = true
    } catch (error) {
      throw new SettingsStorageError(
        '初始化设置存储失败',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * 获取完整设置
   */
  async getSettings(): Promise<AppSettings> {
    await this.ensureInitialized()
    return this.cloneSettings(this.settings!)
  }

  /**
   * 获取 AI 设置
   */
  async getAiSettings(): Promise<AiSettings> {
    await this.ensureInitialized()
    return this.cloneSettings(this.settings!.ai)
  }

  /**
   * 获取看板视图设置
   */
  async getBoardViewSettings(): Promise<BoardViewSettings> {
    await this.ensureInitialized()
    return this.cloneSettings(this.settings!.boardView)
  }

  /**
   * 更新完整设置
   */
  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    await this.ensureInitialized()

    this.settings = {
      ...this.settings!,
      ...settings,
      updatedAt: new Date().toISOString(),
    }

    await this.saveToFile()
    return this.cloneSettings(this.settings)
  }

  /**
   * 更新 AI 设置
   */
  async updateAiSettings(aiSettings: Partial<AiSettings>): Promise<AiSettings> {
    await this.ensureInitialized()

    this.settings!.ai = {
      ...this.settings!.ai,
      ...aiSettings,
    }
    this.settings!.updatedAt = new Date().toISOString()

    await this.saveToFile()
    return this.cloneSettings(this.settings!.ai)
  }

  /**
   * 更新 AI 工具触发配置
   */
  async updateToolTriggerConfig(config: AiSettings['toolTrigger']): Promise<AiSettings> {
    return this.updateAiSettings({ toolTrigger: config })
  }

  /**
   * 更新 AI 命令
   */
  async updateAiCommands(commands: AiSettings['commands']): Promise<AiSettings> {
    const normalized = normalizeAiCommands(commands)
    return this.updateAiSettings({ commands: normalized })
  }

  /**
   * 更新看板视图设置
   */
  async updateBoardViewSettings(viewSettings: Partial<BoardViewSettings>): Promise<BoardViewSettings> {
    await this.ensureInitialized()

    this.settings!.boardView = {
      ...this.settings!.boardView,
      ...viewSettings,
    }
    this.settings!.updatedAt = new Date().toISOString()

    await this.saveToFile()
    return this.cloneSettings(this.settings!.boardView)
  }

  /**
   * 重置为默认设置
   */
  async resetToDefaults(): Promise<AppSettings> {
    await this.ensureInitialized()

    this.settings = createDefaultSettings()
    this.settings.ai.commands = createDefaultAiCommands()
    
    await this.saveToFile()
    return this.cloneSettings(this.settings)
  }

  /**
   * 从文件加载设置
   */
  private async loadFromFile(): Promise<AppSettings | null> {
    try {
      const content = await fs.readFile(SETTINGS_FILE, 'utf-8')
      const parsed = JSON.parse(content) as AppSettings
      
      // 基本验证
      if (!parsed || typeof parsed !== 'object') {
        return null
      }
      
      return parsed
    } catch (error) {
      // 文件不存在返回 null
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * 保存设置到文件
   */
  private async saveToFile(): Promise<void> {
    try {
      const content = JSON.stringify(this.settings, null, 2)
      await fs.writeFile(SETTINGS_FILE, content, 'utf-8')
    } catch (error) {
      throw new SettingsStorageError(
        '保存设置文件失败',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * 深拷贝设置对象
   */
  private cloneSettings<T>(settings: T): T {
    return JSON.parse(JSON.stringify(settings))
  }

  /**
   * 与默认设置合并（处理版本升级时的新增字段）
   */
  private mergeWithDefaults(saved: AppSettings): AppSettings {
    const defaults = createDefaultSettings()
    
    return {
      ...defaults,
      ...saved,
      ai: {
        ...defaults.ai,
        ...saved.ai,
        toolTrigger: {
          ...defaults.ai.toolTrigger,
          ...saved.ai?.toolTrigger,
          prefixes: {
            ...defaults.ai.toolTrigger.prefixes,
            ...saved.ai?.toolTrigger?.prefixes,
          },
        },
        commands: saved.ai?.commands?.length 
          ? normalizeAiCommands(saved.ai.commands)
          : createDefaultAiCommands(),
      },
      boardView: {
        ...defaults.boardView,
        ...saved.boardView,
      },
      updatedAt: new Date().toISOString(),
    }
  }
}

/**
 * 获取设置存储实例（便捷函数）
 */
export async function getSettingsStorage(): Promise<SettingsStorage> {
  const storage = SettingsStorage.getInstance()
  await storage.initialize()
  return storage
}
