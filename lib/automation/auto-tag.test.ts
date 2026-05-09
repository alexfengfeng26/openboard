import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { RuleEngine } from './RuleEngine'
import { getStorage, resetStorage } from '../storage/StorageAdapter'
import { SettingsStorage } from '../storage/SettingsStorage'
import type { StorageAdapter } from '../storage/StorageAdapter'
import type { AutomationRule, TriggerContext } from '@/types/automation.types'

const DATA_DIR = path.join(process.cwd(), 'data')

async function cleanupTestFiles() {
  try {
    const files = await fs.readdir(DATA_DIR)
    for (const file of files) {
      if (file.startsWith('test-') && (file.endsWith('.md') || file.endsWith('.lock'))) {
        await fs.unlink(path.join(DATA_DIR, file))
      }
    }
    const indexPath = path.join(DATA_DIR, '_boards.json')
    try { await fs.unlink(indexPath) } catch { /* ignore */ }
  } catch { /* ignore */ }
}

function createAutoTagRule(boardId: string): AutomationRule {
  return {
    id: 'rule-test-auto-tag',
    name: '自动匹配标签',
    description: '测试 auto_tag',
    enabled: true,
    trigger: { type: 'card_created', conditions: [] },
    actions: [{ type: 'auto_tag', params: {} }],
    boardId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('RuleEngine auto_tag action', () => {
  let storage: StorageAdapter

  beforeEach(async () => {
    await cleanupTestFiles()
    resetStorage()
    storage = await getStorage()
  })

  afterEach(async () => {
    await cleanupTestFiles()
  })

  it('should use global tags when board has no tags', async () => {
    // 1. 创建无标签看板
    const board = await storage.createBoard('Test Board No Tags')
    expect(board.tags).toEqual([])

    // 2. 确保全局标签池中有 "选题" 标签
    const settingsStorage = SettingsStorage.getInstance()
    await settingsStorage.initialize()
    const globalTags = await settingsStorage.getGlobalTags()
    const xuanTiTag = globalTags.find((t) => t.name === '选题')
    expect(xuanTiTag).toBeDefined()

    // 3. 在看板第一个列表中创建包含"选题"的卡片
    const laneId = board.lanes[0].id
    const card = await storage.createCard(board.id, laneId, '如何挖掘高互动选题方向', '从评论区找灵感')
    expect(card.tags || []).toEqual([])

    // 4. 执行 auto_tag 规则
    const rule = createAutoTagRule(board.id)
    const context: TriggerContext = {
      boardId: board.id,
      cardId: card.id,
      laneId,
      cardTitle: card.title,
      cardDescription: card.description,
    }
    const result = await RuleEngine.executeActions(rule, context)
    expect(result.success).toBe(true)
    expect(result.executed).toBe(1)

    // 5. 验证卡片被添加了"选题"标签
    const updatedBoard = await storage.getBoard(board.id)
    const updatedCard = updatedBoard!.lanes
      .flatMap((l) => l.cards)
      .find((c) => c.id === card.id)
    expect(updatedCard!.tags!.length).toBeGreaterThanOrEqual(1)
    expect(updatedCard!.tags!.some((t) => t.name === '选题')).toBe(true)
  })

  it('should use board tags when board has custom tags', async () => {
    // 1. 创建看板并设置自定义标签
    const board = await storage.createBoard('Test Board With Tags')
    const customTag = { id: 'tag-custom', name: '自定义', color: '#ff0000' }
    await storage.updateBoard(board.id, { tags: [customTag] })

    // 2. 创建包含"自定义"的卡片
    const laneId = board.lanes[0].id
    const card = await storage.createCard(board.id, laneId, '这是一个自定义任务', '')

    // 3. 执行 auto_tag 规则
    const rule = createAutoTagRule(board.id)
    const context: TriggerContext = {
      boardId: board.id,
      cardId: card.id,
      laneId,
      cardTitle: card.title,
    }
    await RuleEngine.executeActions(rule, context)

    // 4. 验证卡片被添加了看板自定义标签（而非全局标签）
    const updatedBoard = await storage.getBoard(board.id)
    const updatedCard = updatedBoard!.lanes
      .flatMap((l) => l.cards)
      .find((c) => c.id === card.id)
    expect(updatedCard!.tags!.some((t) => t.name === '自定义')).toBe(true)
  })

  it('should not duplicate existing tags', async () => {
    // 1. 创建看板并设置标签
    const board = await storage.createBoard('Test Board Dedup')
    const tag = { id: 'tag-xuanti', name: '选题', color: '#f97316' }
    await storage.updateBoard(board.id, { tags: [tag] })

    // 2. 创建已带"选题"标签的卡片
    const laneId = board.lanes[0].id
    const card = await storage.createCard(board.id, laneId, '选题方向讨论', '', [tag])
    expect(card.tags!.length).toBe(1)

    // 3. 再次执行 auto_tag
    const rule = createAutoTagRule(board.id)
    const context: TriggerContext = {
      boardId: board.id,
      cardId: card.id,
      laneId,
      cardTitle: card.title,
    }
    await RuleEngine.executeActions(rule, context)

    // 4. 验证标签没有重复添加
    const updatedBoard = await storage.getBoard(board.id)
    const updatedCard = updatedBoard!.lanes
      .flatMap((l) => l.cards)
      .find((c) => c.id === card.id)
    expect(updatedCard!.tags!.length).toBe(1)
  })
})
