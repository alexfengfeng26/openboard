/**
 * 模板存储适配器
 * 使用 JSON 文件存储模板数据，索引与数据分离
 */

import { promises as fs } from 'fs'
import path from 'path'
import type {
  Template,
  TemplateIndex,
  TemplateIndexEntry,
  TemplateType,
  ExportBundle,
  ImportResult,
} from '@/types/template.types'
import { FileLock } from './FileLock'

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates')
const INDEX_FILE = path.join(TEMPLATES_DIR, 'templates.json')

function createId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getTemplateFilePath(type: TemplateType, id: string): string {
  return path.join(TEMPLATES_DIR, type, `${id}.json`)
}

/**
 * 模板存储类
 */
export class TemplateStorage {
  private static instance: TemplateStorage | null = null
  private initialized = false

  private constructor() {}

  static getInstance(): TemplateStorage {
    if (!TemplateStorage.instance) {
      TemplateStorage.instance = new TemplateStorage()
    }
    return TemplateStorage.instance
  }

  /**
   * 初始化存储目录和索引文件
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // 创建类型子目录
    const types: TemplateType[] = ['board', 'card', 'lane', 'automation', 'prompt']
    for (const t of types) {
      await fs.mkdir(path.join(TEMPLATES_DIR, t), { recursive: true })
    }

    // 确保索引文件存在
    try {
      await fs.access(INDEX_FILE)
    } catch {
      const defaultIndex: TemplateIndex = {
        version: 1,
        updatedAt: new Date().toISOString(),
        templates: [],
      }
      await this.writeIndex(defaultIndex)
    }

    // 清理可能遗留的过期锁文件
    await FileLock.cleanupStaleLocks()

    this.initialized = true
  }

  /**
   * 获取索引
   * 读操作不加锁：writeIndex 使用原子重命名写入，读操作不会读到半写文件
   */
  async getIndex(): Promise<TemplateIndex> {
    await this.ensureInitialized()

    try {
      const content = await fs.readFile(INDEX_FILE, 'utf-8')
      return JSON.parse(content) as TemplateIndex
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: 1, updatedAt: new Date().toISOString(), templates: [] }
      }
      throw error
    }
  }

  /**
   * 更新索引
   */
  async updateIndex(index: TemplateIndex): Promise<void> {
    await this.ensureInitialized()
    await this.writeIndex(index)
  }

  /**
   * 重建索引（扫描所有模板文件）
   */
  async rebuildIndex(): Promise<TemplateIndex> {
    await this.ensureInitialized()

    const types: TemplateType[] = ['board', 'card', 'lane', 'automation', 'prompt']
    const entries: TemplateIndexEntry[] = []

    for (const t of types) {
      const dir = path.join(TEMPLATES_DIR, t)
      try {
        const files = await fs.readdir(dir)
        for (const file of files) {
          if (!file.endsWith('.json')) continue
          const id = file.replace('.json', '')
          const template = await this.read(t, id)
          if (template) {
            entries.push({
              id: template.meta.id,
              type: template.meta.type,
              name: template.meta.name,
              description: template.meta.description,
              tags: template.meta.tags,
              icon: template.meta.icon,
              scope: template.meta.scope,
              boardId: template.meta.boardId,
              builtin: template.meta.builtin,
              path: `${t}/${file}`,
            })
          }
        }
      } catch {
        // 目录不存在则跳过
      }
    }

    const index: TemplateIndex = {
      version: 1,
      updatedAt: new Date().toISOString(),
      templates: entries,
    }

    await this.writeIndex(index)
    return index
  }

  /**
   * 读取单个模板
   */
  async read(type: TemplateType, id: string): Promise<Template | null> {
    await this.ensureInitialized()

    const filePath = getTemplateFilePath(type, id)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as Template
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * 写入单个模板
   */
  async write(type: TemplateType, id: string, template: Template): Promise<void> {
    await this.ensureInitialized()

    const filePath = getTemplateFilePath(type, id)
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    const release = await FileLock.acquire(filePath, { maxRetries: 10, timeout: 5000 })
    try {
      const tempFile = filePath + '.tmp'
      await fs.writeFile(tempFile, JSON.stringify(template, null, 2), 'utf-8')
      await fs.rename(tempFile, filePath)
    } finally {
      await release()
    }
  }

  /**
   * 删除单个模板
   */
  async remove(type: TemplateType, id: string): Promise<void> {
    await this.ensureInitialized()

    const filePath = getTemplateFilePath(type, id)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  /**
   * 列出所有模板（可选按类型过滤）
   */
  async list(type?: TemplateType): Promise<Template[]> {
    await this.ensureInitialized()

    const index = await this.getIndex()
    const entries = type
      ? index.templates.filter((e) => e.type === type)
      : index.templates

    const templates: Template[] = []
    for (const entry of entries) {
      const template = await this.read(entry.type, entry.id)
      if (template) {
        templates.push(template)
      }
    }

    return templates
  }

  /**
   * 导出指定模板
   */
  async export(ids: string[]): Promise<ExportBundle> {
    const index = await this.getIndex()
    const templates: Template[] = []

    for (const id of ids) {
      const entry = index.templates.find((e) => e.id === id)
      if (entry) {
        const template = await this.read(entry.type, entry.id)
        if (template) {
          templates.push(template)
        }
      }
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates,
    }
  }

  /**
   * 导入模板包
   */
  async import(bundle: ExportBundle): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      overwritten: 0,
      errors: [],
    }

    const index = await this.getIndex()
    for (const template of bundle.templates) {
      try {
        // 验证模板数据
        if (!template.meta || !template.meta.type || !template.meta.name) {
          result.errors.push({
            templateName: template.meta?.name || 'unknown',
            reason: '模板数据不完整',
          })
          continue
        }

        // 跳过内置模板（避免重复导入系统预设）
        if (template.meta.builtin) {
          result.skipped++
          continue
        }

        // 生成新 ID，避免冲突
        const newId = createId()
        const newTemplate: Template = {
          ...template,
          meta: {
            ...template.meta,
            id: newId,
            builtin: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }

        await this.write(newTemplate.meta.type, newId, newTemplate)

        index.templates.push({
          id: newId,
          type: newTemplate.meta.type,
          name: newTemplate.meta.name,
          description: newTemplate.meta.description,
          tags: newTemplate.meta.tags,
          icon: newTemplate.meta.icon,
          scope: newTemplate.meta.scope,
          boardId: newTemplate.meta.boardId,
          builtin: false,
          path: `${newTemplate.meta.type}/${newId}.json`,
        })

        result.imported++
      } catch (error) {
        result.errors.push({
          templateName: template.meta?.name || 'unknown',
          reason: error instanceof Error ? error.message : '导入失败',
        })
      }
    }

    index.updatedAt = new Date().toISOString()
    await this.writeIndex(index)
    result.success = result.errors.length === 0

    return result
  }

  /**
   * 检查模板是否存在
   */
  async exists(type: TemplateType, id: string): Promise<boolean> {
    const filePath = getTemplateFilePath(type, id)
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 私有：写入索引文件
   */
  private async writeIndex(index: TemplateIndex): Promise<void> {
    const release = await FileLock.acquire(INDEX_FILE, { maxRetries: 20, timeout: 10000 })
    try {
      const tempFile = INDEX_FILE + '.tmp'
      await fs.writeFile(tempFile, JSON.stringify(index, null, 2), 'utf-8')
      await fs.rename(tempFile, INDEX_FILE)
    } finally {
      await release()
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
}

/**
 * 获取模板存储实例（便捷函数）
 */
export async function getTemplateStorage(): Promise<TemplateStorage> {
  const storage = TemplateStorage.getInstance()
  await storage.initialize()
  return storage
}
