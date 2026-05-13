import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TemplateManager } from './TemplateManager'
import { promises as fs } from 'fs'
import path from 'path'
import { FileLock } from '@/lib/storage/FileLock'

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates')
const INDEX_FILE = path.join(TEMPLATES_DIR, 'templates.json')
const LOCK_DIR = path.join(process.cwd(), 'data', '.lock')

const TEST_PREFIXES = ['test-', 'user-']

function isTestId(id: string): boolean {
  return TEST_PREFIXES.some((p) => id.startsWith(p))
}

/**
 * 递归清理测试数据文件
 */
async function cleanupTestFiles(dir: string): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await cleanupTestFiles(fullPath)
      } else if (entry.name.endsWith('.json') && TEST_PREFIXES.some((p) => entry.name.startsWith(p))) {
        await fs.unlink(fullPath)
      }
    }
  } catch {
    // ignore
  }
}

/**
 * 清理索引中的测试条目（使用 FileLock）
 */
async function cleanupTestIndex(): Promise<void> {
  try {
    const release = await FileLock.acquire(INDEX_FILE, { maxRetries: 3, timeout: 3000 })
    try {
      const content = await fs.readFile(INDEX_FILE, 'utf-8')
      const index = JSON.parse(content)
      if (Array.isArray(index.templates)) {
        index.templates = index.templates.filter((t: { id?: string }) => !t.id || !isTestId(t.id))
        index.updatedAt = new Date().toISOString()
        await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8')
      }
    } finally {
      await release()
    }
  } catch {
    // ignore
  }
}

/**
 * 清理可能遗留的锁文件
 */
async function cleanupStaleLocks(): Promise<void> {
  try {
    const lockFile = path.join(LOCK_DIR, 'templates.json.lock')
    await fs.unlink(lockFile)
  } catch {
    // ignore
  }
}

/**
 * 完整清理测试数据
 */
async function cleanupTestData(): Promise<void> {
  await cleanupStaleLocks()
  await cleanupTestFiles(TEMPLATES_DIR)
  await cleanupTestIndex()
}

describe('TemplateManager', () => {
  let manager: TemplateManager

  beforeEach(async () => {
    await cleanupTestData()
    manager = TemplateManager.getInstance()
    await manager.initialize()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  it('should create a template', async () => {
    const draft = {
      meta: {
        type: 'board' as const,
        name: '测试看板模板',
        description: '用于测试',
        scope: 'global' as const,
        builtin: false,
      },
      content: {
        lanes: [{ title: '待办' }, { title: '已完成' }],
      },
    }

    const template = await manager.create(draft)
    expect(template.meta.name).toBe('测试看板模板')
    expect(template.meta.id).toBeDefined()
    expect(template.meta.builtin).toBe(false)
  })

  it('should get a template by id', async () => {
    const draft = {
      meta: {
        type: 'card' as const,
        name: '测试卡片模板',
        scope: 'global' as const,
        builtin: false,
      },
      content: { title: '卡片标题' },
    }

    const created = await manager.create(draft)
    const fetched = await manager.get(created.meta.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.meta.name).toBe('测试卡片模板')
  })

  it('should list templates with filter', async () => {
    await manager.create({
      meta: { type: 'board', name: '看板A', scope: 'global', builtin: false },
      content: { lanes: [] },
    })
    await manager.create({
      meta: { type: 'card', name: '卡片A', scope: 'global', builtin: false },
      content: { title: '标题' },
    })

    const all = await manager.list()
    expect(all.length).toBeGreaterThanOrEqual(2)

    const boards = await manager.list({ type: 'board' })
    expect(boards.some((t) => t.meta.name === '看板A')).toBe(true)

    const cards = await manager.list({ type: 'card' })
    expect(cards.some((t) => t.meta.name === '卡片A')).toBe(true)
  })

  it('should delete a template', async () => {
    const draft = {
      meta: { type: 'lane', name: '测试列表', scope: 'global', builtin: false },
      content: { title: '列表标题' },
    }

    const created = await manager.create(draft)
    const deleted = await manager.delete(created.meta.id)
    expect(deleted).toBe(true)

    const fetched = await manager.get(created.meta.id)
    expect(fetched).toBeNull()
  })

  it('should reject deleting builtin template', async () => {
    const draft = {
      meta: { type: 'board', name: '内置模板', scope: 'global', builtin: true },
      content: { lanes: [] },
    }

    const created = await manager.create(draft)
    await expect(manager.delete(created.meta.id)).rejects.toThrow('内置模板不可删除')
  })

  it('should clone a builtin template', async () => {
    const draft = {
      meta: { type: 'prompt', name: '内置提示词', scope: 'global', builtin: true },
      content: { text: '你好' },
    }

    const created = await manager.create(draft)
    const cloned = await manager.clone(created.meta.id)
    expect(cloned).not.toBeNull()
    expect(cloned?.meta.builtin).toBe(false)
    expect(cloned?.meta.name).toContain('副本')
  })

  it('should apply prompt template with variable resolution', async () => {
    const draft = {
      meta: { type: 'prompt', name: '测试提示词', scope: 'global', builtin: false },
      content: { text: '看板：{{board.title}}，列表：{{lane.title}}' },
    }

    const created = await manager.create(draft)
    const result = await manager.apply(created.meta.id, {
      board: { id: 'b1', title: 'Sprint 1' },
      lane: { id: 'l1', title: '进行中' },
    })

    expect(result?.text).toBe('看板：Sprint 1，列表：进行中')
  })

  it('should export and import templates', async () => {
    const draft = {
      meta: { type: 'board', name: '导出测试', scope: 'global', builtin: false },
      content: { lanes: [{ title: 'Lane 1' }] },
    }

    const created = await manager.create(draft)
    const bundle = await manager.export([created.meta.id])
    expect(bundle.templates.length).toBe(1)
    expect(bundle.version).toBe(1)

    const result = await manager.import(bundle)
    expect(result.imported).toBe(1)

    const list = await manager.list({ q: '导出测试' })
    expect(list.length).toBeGreaterThanOrEqual(1)
  })
})
