/**
 * 存储适配器 - 替代 lowdb 的主存储类
 * 保持与 dbHelpers 相同的接口，实现 Markdown 文件存储
 */

import { promises as fs } from 'fs'
import path from 'path'
import type { Board, Lane, Card, Tag } from '@/types'
import type { LockAcquisitionError } from '@/types/storage.types'
import {
  StorageReadError,
  StorageWriteError,
  MarkdownParseError,
} from '@/types/storage.types'
import { MarkdownBoard } from './MarkdownBoard'
import { BoardCache } from './BoardCache'
import { FileLock } from './FileLock'
import { SettingsStorage } from './SettingsStorage'

/**
 * 数据目录路径
 */
const DATA_DIR = path.join(process.cwd(), 'data')
const DB_JSON_PATH = path.join(DATA_DIR, 'db.json')
const MIGRATION_FLAG = path.join(DATA_DIR, '.migration-complete')

/**
 * 存储适配器类
 * 实现 dbHelpers 的所有方法，底层使用 Markdown 文件存储
 */
export class StorageAdapter {
  private cache: BoardCache
  private migrationComplete: boolean = false

  constructor(ttl?: number) {
    this.cache = new BoardCache(ttl)
  }

  /**
   * 初始化存储（检查迁移）
   */
  async initialize(): Promise<void> {
    // 检查是否需要迁移
    if (await this.needsMigration()) {
      await this.migrateFromJson()
    }

    // 清理过期的锁文件
    await FileLock.cleanupStaleLocks()

    this.migrationComplete = true
  }

  /**
   * ========== 看板操作 ==========
   */

  /**
   * 获取所有看板列表（轻量级）
   */
  async getBoards(): Promise<Array<{ id: string; title: string; createdAt: string; updatedAt: string }>> {
    const boardIds = await MarkdownBoard.listAll()
    const result: Array<{ id: string; title: string; createdAt: string; updatedAt: string }> = []

    for (const boardId of boardIds) {
      // 尝试从缓存获取元数据
      let board = this.cache.get(boardId)

      if (!board) {
        // 缓存未命中，读取文件
        try {
          board = await MarkdownBoard.read(boardId)
          if (board) {
            this.cache.set(boardId, board)
          }
        } catch (error) {
          if (error instanceof StorageReadError || error instanceof MarkdownParseError) {
            // 读取或解析失败，跳过该看板
            continue
          }
          throw error
        }
      }

      if (board) {
        result.push({
          id: board.id,
          title: board.title,
          createdAt: board.createdAt,
          updatedAt: board.updatedAt,
        })
      }
    }

    return result
  }

  /**
   * 根据 ID 获取看板
   */
  async getBoard(boardId: string): Promise<Board | null> {
    // 先查缓存
    const cached = this.cache.get(boardId)
    if (cached) {
      return cached
    }

    return await MarkdownBoard.read(boardId)
  }

  /**
   * 创建新看板
   */
  async createBoard(title: string): Promise<Board> {
    const now = new Date().toISOString()
    const boardId = this.createBoardId()

    const newBoard: Board = {
      id: boardId,
      title,
      createdAt: now,
      updatedAt: now,
      tags: [],
      lanes: [
        {
          id: this.createLaneId(boardId, 0),
          boardId,
          title: '待办',
          position: 0,
          createdAt: now,
          updatedAt: now,
          cards: [],
        },
        {
          id: this.createLaneId(boardId, 1),
          boardId,
          title: '进行中',
          position: 1,
          createdAt: now,
          updatedAt: now,
          cards: [],
        },
        {
          id: this.createLaneId(boardId, 2),
          boardId,
          title: '已完成',
          position: 2,
          createdAt: now,
          updatedAt: now,
          cards: [],
        },
      ],
    }

    await MarkdownBoard.write(newBoard)
    this.cache.set(boardId, newBoard)

    return newBoard
  }

  /**
   * 更新看板
   */
  async updateBoard(boardId: string, data: { title?: string }): Promise<Board | null> {
    const board = await this.getBoard(boardId)
    if (!board) return null

    const updated: Board = {
      ...board,
      ...data,
      updatedAt: new Date().toISOString(),
    }

    await MarkdownBoard.write(updated)
    this.cache.invalidate(boardId)

    return updated
  }

  /**
   * 删除看板（至少保留一个）
   */
  async deleteBoard(boardId: string): Promise<boolean> {
    const allBoards = await this.getBoards()
    if (allBoards.length <= 1) {
      throw new Error('Cannot delete the last board')
    }

    await MarkdownBoard.delete(boardId)
    this.cache.delete(boardId)

    return true
  }

  /**
   * 获取默认看板（保持兼容性）
   */
  async getDefaultBoard(): Promise<Board | null> {
    return this.getBoard('default-board')
  }

  /**
   * 获取所有标签（从全局设置获取）
   */
  async getTags(): Promise<Tag[]> {
    const settingsStorage = SettingsStorage.getInstance()
    await settingsStorage.initialize()
    return settingsStorage.getGlobalTags()
  }

  /**
   * ========== 列表操作 ==========
   */

  /**
   * 创建列表
   */
  async createLane(boardId: string, title: string): Promise<Lane> {
    const board = await this.getBoard(boardId)
    if (!board) throw new Error('Board not found')

    const now = new Date().toISOString()
    const newLane: Lane = {
      id: this.createLaneId(boardId, board.lanes.length),
      boardId,
      title,
      position: board.lanes.length,
      createdAt: now,
      updatedAt: now,
      cards: [],
    }

    // 更新看板
    const updatedBoard: Board = {
      ...board,
      lanes: [...board.lanes, newLane],
      updatedAt: now,
    }

    await MarkdownBoard.write(updatedBoard)
    this.cache.invalidate(boardId)

    return newLane
  }

  /**
   * 更新列表
   */
  async updateLane(boardId: string, laneId: string, data: { title?: string }): Promise<void> {
    const board = await this.getBoard(boardId)
    if (!board) return

    const lane = board.lanes.find((l) => l.id === laneId)
    if (!lane) return

    const now = new Date().toISOString()
    const updatedLane: Lane = {
      ...lane,
      ...data,
      updatedAt: now,
    }

    const updatedBoard: Board = {
      ...board,
      lanes: board.lanes.map((l) => (l.id === laneId ? updatedLane : l)),
      updatedAt: now,
    }

    await MarkdownBoard.write(updatedBoard)
    this.cache.invalidate(boardId)
  }

  /**
   * 删除列表
   */
  async deleteLane(boardId: string, laneId: string): Promise<void> {
    const board = await this.getBoard(boardId)
    if (!board) return

    const updatedBoard: Board = {
      ...board,
      lanes: board.lanes.filter((l) => l.id !== laneId),
      updatedAt: new Date().toISOString(),
    }

    await MarkdownBoard.write(updatedBoard)
    this.cache.invalidate(boardId)
  }

  /**
   * ========== 卡片操作 ==========
   */

  /**
   * 创建卡片
   */
  async createCard(
    boardId: string,
    laneId: string,
    title: string,
    description?: string,
    tags?: Tag[]
  ): Promise<Card> {
    const board = await this.getBoard(boardId)
    if (!board) throw new Error('Board not found')

    const lane = board.lanes.find((l) => l.id === laneId)
    if (!lane) throw new Error('Lane not found')

    const now = new Date().toISOString()
    const newCard: Card = {
      id: this.createCardId(),
      laneId,
      title,
      description,
      position: lane.cards.length,
      createdAt: now,
      updatedAt: now,
      tags: tags || [],
    }

    const updatedLane: Lane = {
      ...lane,
      cards: [...lane.cards, newCard],
      updatedAt: now,
    }

    const updatedBoard: Board = {
      ...board,
      lanes: board.lanes.map((l) => (l.id === laneId ? updatedLane : l)),
      updatedAt: now,
    }

    await MarkdownBoard.write(updatedBoard)
    this.cache.invalidate(boardId)

    return newCard
  }

  /**
   * 更新卡片
   */
  async updateCard(boardId: string, cardId: string, data: { title?: string; description?: string; tags?: Tag[] }): Promise<void> {
    const board = await this.getBoard(boardId)
    if (!board) throw new Error('Board not found')

    const now = new Date().toISOString()

    for (const lane of board.lanes) {
      const cardIndex = lane.cards.findIndex((c) => c.id === cardId)
      if (cardIndex !== -1) {
        const updatedCard: Card = {
          ...lane.cards[cardIndex],
          ...data,
          updatedAt: now,
        }

        const updatedLane: Lane = {
          ...lane,
          cards: lane.cards.map((c, i) => (i === cardIndex ? updatedCard : c)),
          updatedAt: now,
        }

        const updatedBoard: Board = {
          ...board,
          lanes: board.lanes.map((l) => (l.id === lane.id ? updatedLane : l)),
          updatedAt: now,
        }

        await MarkdownBoard.write(updatedBoard)
        this.cache.invalidate(boardId)
        return
      }
    }

    throw new Error('Card not found')
  }

  /**
   * 删除卡片
   */
  async deleteCard(boardId: string, cardId: string): Promise<void> {
    const board = await this.getBoard(boardId)
    if (!board) throw new Error('Board not found')

    const now = new Date().toISOString()
    let cardDeleted = false

    const updatedLanes: Lane[] = board.lanes.map((lane) => {
      const hasCard = lane.cards.some((c) => c.id === cardId)
      if (!hasCard) return lane
      cardDeleted = true
      return {
        ...lane,
        cards: lane.cards.filter((c) => c.id !== cardId),
        updatedAt: now,
      }
    })

    if (!cardDeleted) {
      throw new Error('Card not found')
    }

    const updatedBoard: Board = {
      ...board,
      lanes: updatedLanes,
      updatedAt: now,
    }

    await MarkdownBoard.write(updatedBoard)
    this.cache.invalidate(boardId)
  }

  /**
   * 移动卡片
   */
  async moveCard(boardId: string, cardId: string, toLaneId: string, newPosition: number): Promise<void> {
    const board = await this.getBoard(boardId)
    if (!board) throw new Error('Board not found')

    const now = new Date().toISOString()
    let cardToMove: Card | null = null
    let sourceLaneId: string | null = null

    // 查找卡片
    for (const lane of board.lanes) {
      const cardIndex = lane.cards.findIndex((c) => c.id === cardId)
      if (cardIndex !== -1) {
        cardToMove = lane.cards[cardIndex]
        sourceLaneId = lane.id
        break
      }
    }

    if (!cardToMove || !sourceLaneId) throw new Error('Card not found')

    // 从源列表移除
    const updatedLanes: Lane[] = []

    for (const lane of board.lanes) {
      if (lane.id === sourceLaneId) {
        updatedLanes.push({
          ...lane,
          cards: lane.cards.filter((c) => c.id !== cardId),
          updatedAt: now,
        })
      } else if (lane.id === toLaneId) {
        // 添加到目标列表
        const movedCard: Card = {
          ...cardToMove,
          laneId: toLaneId,
          position: newPosition,
          updatedAt: now,
        }
        updatedLanes.push({
          ...lane,
          cards: [...lane.cards, movedCard],
          updatedAt: now,
        })
      } else {
        updatedLanes.push(lane)
      }
    }

    if (!updatedLanes.some((l) => l.id === toLaneId)) {
      throw new Error('Lane not found')
    }

    const updatedBoard: Board = {
      ...board,
      lanes: updatedLanes,
      updatedAt: now,
    }

    await MarkdownBoard.write(updatedBoard)
    this.cache.invalidate(boardId)
  }

  /**
   * ========== 私有辅助方法 ==========
   */

  /**
   * 检查是否需要迁移
   */
  private async needsMigration(): Promise<boolean> {
    try {
      // 检查 db.json 是否存在
      await fs.access(DB_JSON_PATH)

      // 检查是否已经迁移过
      try {
        await fs.access(MIGRATION_FLAG)
        return false
      } catch {
        return true
      }
    } catch {
      return false
    }
  }

  /**
   * 从 JSON 迁移到 Markdown
   */
  private async migrateFromJson(): Promise<void> {
    try {
      // 直接读取 JSON 文件内容
      const jsonContent = await fs.readFile(DB_JSON_PATH, 'utf-8')
      const data = JSON.parse(jsonContent) as { boards: Board[] }

      // 对于每个看板，写入 MD 文件
      for (const board of data.boards) {
        await MarkdownBoard.write(board)
      }

      // 备份原 JSON 文件
      const backupPath = DB_JSON_PATH + '.migrated'
      await fs.copyFile(DB_JSON_PATH, backupPath)

      // 创建迁移完成标记
      await fs.writeFile(MIGRATION_FLAG, new Date().toISOString(), 'utf-8')

      console.log(`[StorageAdapter] 迁移完成: ${data.boards.length} 个看板`)
    } catch (error) {
      console.error('[StorageAdapter] 迁移失败:', error)
      throw error
    }
  }

  /**
   * 创建看板 ID
   */
  private createBoardId(): string {
    return `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * 创建列表 ID
   */
  private createLaneId(boardId: string, index: number): string {
    return `lane-${Date.now()}-${index}`
  }

  /**
   * 创建卡片 ID
   */
  private createCardId(): string {
    return `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * 清理缓存（用于调试或手动刷新）
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return this.cache.getStats()
  }
}

/**
 * 全局存储实例（单例模式）
 */
let globalStorage: StorageAdapter | null = null

/**
 * 获取存储实例
 */
export async function getStorage(): Promise<StorageAdapter> {
  if (!globalStorage) {
    globalStorage = new StorageAdapter()
    await globalStorage.initialize()
  }
  return globalStorage
}

/**
 * 重置存储实例（开发环境使用）
 */
export function resetStorage(): void {
  globalStorage = null
}

/**
 * 为了兼容性，导出与 dbHelpers 相同的接口
 */
export async function dbHelpersWrapper() {
  const storage = await getStorage()
  return {
    // 看板操作
    getBoards: () => storage.getBoards(),
    getBoard: (boardId: string) => storage.getBoard(boardId),
    createBoard: (title: string) => storage.createBoard(title),
    updateBoard: (boardId: string, data: { title?: string }) => storage.updateBoard(boardId, data),
    deleteBoard: (boardId: string) => storage.deleteBoard(boardId),
    getDefaultBoard: () => storage.getDefaultBoard(),
    getTags: () => storage.getTags(),

    // 列表操作
    createLane: (boardId: string, title: string) => storage.createLane(boardId, title),
    updateLane: (boardId: string, laneId: string, data: { title?: string }) =>
      storage.updateLane(boardId, laneId, data),
    deleteLane: (boardId: string, laneId: string) => storage.deleteLane(boardId, laneId),

    // 卡片操作
    createCard: (boardId: string, laneId: string, title: string, description?: string, tags?: Tag[]) =>
      storage.createCard(boardId, laneId, title, description, tags),
    updateCard: (boardId: string, cardId: string, data: { title?: string; description?: string; tags?: Tag[] }) =>
      storage.updateCard(boardId, cardId, data),
    deleteCard: (boardId: string, cardId: string) => storage.deleteCard(boardId, cardId),
    moveCard: (boardId: string, cardId: string, toLaneId: string, newPosition: number) =>
      storage.moveCard(boardId, cardId, toLaneId, newPosition),
  }
}
