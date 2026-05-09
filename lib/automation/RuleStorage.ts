/**
 * 自动化规则持久化存储
 * 使用 JSON 文件存储规则
 */

import { promises as fs } from 'fs'
import path from 'path'
import type { AutomationRule } from '@/types/automation.types'
import { FileLock } from '@/lib/storage/FileLock'

const RULES_FILE = path.join(process.cwd(), 'data', 'automation-rules.json')

export class RuleStorageError extends Error {
  constructor(message: string, cause?: Error) {
    super(message)
    this.name = 'RuleStorageError'
    this.cause = cause
  }
}

/**
 * 规则存储类
 */
export class RuleStorage {
  private static instance: RuleStorage | null = null
  private rules: AutomationRule[] = []
  private initialized = false

  private constructor() {}

  static getInstance(): RuleStorage {
    if (!RuleStorage.instance) {
      RuleStorage.instance = new RuleStorage()
    }
    return RuleStorage.instance
  }

  /**
   * 初始化存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const dataDir = path.dirname(RULES_FILE)
      await fs.mkdir(dataDir, { recursive: true })

      const data = await this.loadFromFile()
      if (data) {
        this.rules = data
      } else {
        this.rules = []
        await this.saveToFile()
      }

      this.initialized = true
    } catch (error) {
      throw new RuleStorageError(
        '初始化规则存储失败',
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * 从文件加载规则
   */
  private async loadFromFile(): Promise<AutomationRule[] | null> {
    try {
      const content = await fs.readFile(RULES_FILE, 'utf-8')
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        return parsed as AutomationRule[]
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * 保存规则到文件
   */
  private async saveToFile(): Promise<void> {
    const release = await FileLock.acquire(RULES_FILE + '.lock')
    try {
      await fs.writeFile(RULES_FILE, JSON.stringify(this.rules, null, 2), 'utf-8')
    } finally {
      await release()
    }
  }

  /**
   * 获取所有规则
   */
  async getAllRules(boardId?: string): Promise<AutomationRule[]> {
    await this.ensureInitialized()
    if (boardId) {
      return this.rules.filter((r) => !r.boardId || r.boardId === boardId)
    }
    return [...this.rules]
  }

  /**
   * 根据ID获取规则
   */
  async getRuleById(id: string): Promise<AutomationRule | undefined> {
    await this.ensureInitialized()
    return this.rules.find((r) => r.id === id)
  }

  /**
   * 创建规则
   */
  async createRule(rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutomationRule> {
    await this.ensureInitialized()
    const now = new Date().toISOString()
    const newRule: AutomationRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    }
    this.rules.push(newRule)
    await this.saveToFile()
    return newRule
  }

  /**
   * 更新规则
   */
  async updateRule(id: string, updates: Partial<Omit<AutomationRule, 'id' | 'createdAt'>>): Promise<AutomationRule | null> {
    await this.ensureInitialized()
    const index = this.rules.findIndex((r) => r.id === id)
    if (index === -1) return null

    this.rules[index] = {
      ...this.rules[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    await this.saveToFile()
    return this.rules[index]
  }

  /**
   * 删除规则
   */
  async deleteRule(id: string): Promise<boolean> {
    await this.ensureInitialized()
    const index = this.rules.findIndex((r) => r.id === id)
    if (index === -1) return false

    this.rules.splice(index, 1)
    await this.saveToFile()
    return true
  }

  /**
   * 切换规则启用状态
   */
  async toggleRule(id: string): Promise<AutomationRule | null> {
    await this.ensureInitialized()
    const index = this.rules.findIndex((r) => r.id === id)
    if (index === -1) return null

    this.rules[index].enabled = !this.rules[index].enabled
    this.rules[index].updatedAt = new Date().toISOString()
    await this.saveToFile()
    return this.rules[index]
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }
}

/**
 * 获取规则存储单例
 */
export async function getRuleStorage(): Promise<RuleStorage> {
  const storage = RuleStorage.getInstance()
  await storage.initialize()
  return storage
}
