/**
 * 模板管理核心类
 * 统一入口，封装存储操作与业务规则
 */

import type {
  Template,
  TemplateDraft,
  TemplateMeta,
  TemplateFilter,
  TemplateVariableContext,
  ExportBundle,
  ImportResult,
} from '@/types/template.types'
import { TemplateStorage, getTemplateStorage } from '@/lib/storage/TemplateStorage'
import { resolveVariablesAsync } from './variable-resolver'

function createId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 模板管理器
 */
export class TemplateManager {
  private static instance: TemplateManager | null = null
  private storage: TemplateStorage | null = null

  private constructor() {}

  static getInstance(): TemplateManager {
    if (!TemplateManager.instance) {
      TemplateManager.instance = new TemplateManager()
    }
    return TemplateManager.instance
  }

  /**
   * 初始化管理器
   */
  async initialize(): Promise<void> {
    if (!this.storage) {
      this.storage = await getTemplateStorage()
    }
  }

  /**
   * 获取模板列表（支持过滤）
   */
  async list(filter?: TemplateFilter): Promise<Template[]> {
    await this.ensureInitialized()

    const index = await this.storage!.getIndex()
    let entries = index.templates

    if (filter?.type) {
      entries = entries.filter((e) => e.type === filter.type)
    }
    if (filter?.scope) {
      entries = entries.filter((e) => e.scope === filter.scope)
    }
    if (filter?.boardId) {
      entries = entries.filter((e) => e.scope === 'global' || e.boardId === filter.boardId)
    }
    if (filter?.tag) {
      entries = entries.filter((e) => e.tags?.includes(filter.tag!))
    }
    if (filter?.q) {
      const q = filter.q.toLowerCase()
      entries = entries.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.tags?.some((t) => t.toLowerCase().includes(q))
      )
    }

    const templates: Template[] = []
    for (const entry of entries) {
      const template = await this.storage!.read(entry.type, entry.id)
      if (template) templates.push(template)
    }

    return templates
  }

  /**
   * 获取单个模板
   */
  async get(id: string): Promise<Template | null> {
    await this.ensureInitialized()

    const index = await this.storage!.getIndex()
    const entry = index.templates.find((e) => e.id === id)
    if (!entry) return null

    return this.storage!.read(entry.type, entry.id)
  }

  /**
   * 创建模板
   */
  async create(draft: TemplateDraft): Promise<Template> {
    await this.ensureInitialized()

    const now = new Date().toISOString()
    const id = createId()

    const template: Template = {
      meta: {
        ...draft.meta,
        id,
        createdAt: now,
        updatedAt: now,
      },
      content: draft.content,
    }

    await this.storage!.write(template.meta.type, id, template)

    // 更新索引
    const index = await this.storage!.getIndex()
    index.templates.push({
      id,
      type: template.meta.type,
      name: template.meta.name,
      description: template.meta.description,
      tags: template.meta.tags,
      icon: template.meta.icon,
      scope: template.meta.scope,
      boardId: template.meta.boardId,
      builtin: template.meta.builtin,
      path: `${template.meta.type}/${id}.json`,
    })
    index.updatedAt = now
    await this.storage!.updateIndex(index)

    return template
  }

  /**
   * 更新模板（内置模板禁止修改）
   */
  async update(id: string, patch: Partial<Omit<Template, 'meta'>> & { meta?: Partial<Omit<TemplateMeta, 'id' | 'createdAt' | 'type'>> }): Promise<Template | null> {
    await this.ensureInitialized()

    const existing = await this.get(id)
    if (!existing) return null

    if (existing.meta.builtin) {
      throw new Error('内置模板不可直接修改，请使用克隆功能创建副本')
    }

    const now = new Date().toISOString()
    const updated: Template = {
      meta: {
        ...existing.meta,
        ...patch.meta,
        updatedAt: now,
      },
      content: patch.content ?? existing.content,
    }

    await this.storage!.write(updated.meta.type, id, updated)

    // 更新索引
    const index = await this.storage!.getIndex()
    const entryIndex = index.templates.findIndex((e) => e.id === id)
    if (entryIndex !== -1) {
      index.templates[entryIndex] = {
        ...index.templates[entryIndex],
        name: updated.meta.name,
        description: updated.meta.description,
        tags: updated.meta.tags,
        icon: updated.meta.icon,
        scope: updated.meta.scope,
        boardId: updated.meta.boardId,
      }
      index.updatedAt = now
      await this.storage!.updateIndex(index)
    }

    return updated
  }

  /**
   * 删除模板（内置模板禁止删除）
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized()

    const existing = await this.get(id)
    if (!existing) return false

    if (existing.meta.builtin) {
      throw new Error('内置模板不可删除')
    }

    await this.storage!.remove(existing.meta.type, id)

    // 更新索引
    const index = await this.storage!.getIndex()
    index.templates = index.templates.filter((e) => e.id !== id)
    index.updatedAt = new Date().toISOString()
    await this.storage!.updateIndex(index)

    return true
  }

  /**
   * 应用模板（解析变量）
   */
  async apply(id: string, context: TemplateVariableContext): Promise<{ text?: string; content?: Template['content'] } | null> {
    await this.ensureInitialized()

    const template = await this.get(id)
    if (!template) return null

    // prompt 类型返回解析后的文本
    if (template.meta.type === 'prompt') {
      const promptContent = template.content as { text: string }
      const resolvedText = await resolveVariablesAsync(promptContent.text, context)
      return { text: resolvedText }
    }

    // 其他类型返回原始内容（由业务层处理）
    return { content: template.content }
  }

  /**
   * 克隆内置模板为自定义模板
   */
  async clone(id: string, overrides?: Partial<TemplateDraft['meta']>): Promise<Template | null> {
    await this.ensureInitialized()

    const existing = await this.get(id)
    if (!existing) return null

    const draft: TemplateDraft = {
      meta: {
        ...existing.meta,
        ...overrides,
        builtin: false,
        scope: overrides?.scope || existing.meta.scope,
        name: overrides?.name || `${existing.meta.name} (副本)`,
      },
      content: existing.content,
    }

    return this.create(draft)
  }

  /**
   * 导出模板
   */
  async export(ids: string[]): Promise<ExportBundle> {
    await this.ensureInitialized()
    return this.storage!.export(ids)
  }

  /**
   * 导入模板
   */
  async import(bundle: ExportBundle): Promise<ImportResult> {
    await this.ensureInitialized()
    return this.storage!.import(bundle)
  }

  /**
   * 重建索引
   */
  async rebuildIndex(): Promise<void> {
    await this.ensureInitialized()
    await this.storage!.rebuildIndex()
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.storage) {
      await this.initialize()
    }
  }
}

/**
 * 获取模板管理器实例（便捷函数）
 */
export async function getTemplateManager(): Promise<TemplateManager> {
  const manager = TemplateManager.getInstance()
  await manager.initialize()
  return manager
}
