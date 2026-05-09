/**
 * 存储适配器 - 替代 lowdb 的主存储类
 * 保持与 dbHelpers 相同的接口，实现 Markdown 文件存储
 */

import { promises as fs } from 'fs'
import path from 'path'
import type { Board, Lane, Card, Tag, CardPriority, Attachment } from '@/types'
import type { OperationLogEntry } from '@/types/ai-tools.types'
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
const INDEX_FILE = path.join(DATA_DIR, '_boards.json')

interface BoardIndexEntry {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
  favoritedAt?: string
  icon?: string
  cardCount: number
}

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
  async getBoards(includeArchived = false): Promise<Array<{ id: string; title: string; createdAt: string; updatedAt: string; archivedAt?: string; favoritedAt?: string; icon?: string }>> {
    // 首先尝试从索引文件加载
    const index = await this.loadIndex()
    if (index) {
      return index
        .filter(entry => includeArchived || !entry.archivedAt)
        .map(entry => ({
          id: entry.id,
          title: entry.title,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          archivedAt: entry.archivedAt,
          favoritedAt: entry.favoritedAt,
          icon: entry.icon,
        }))
    }

    // 索引不存在，回退到扫描 Markdown 文件
    const boardIds = await MarkdownBoard.listAll()
    const result: Array<{ id: string; title: string; createdAt: string; updatedAt: string; archivedAt?: string; favoritedAt?: string; icon?: string }> = []
    const indexEntries: BoardIndexEntry[] = []

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
        if (includeArchived || !board.archivedAt) {
          result.push({
            id: board.id,
            title: board.title,
            createdAt: board.createdAt,
            updatedAt: board.updatedAt,
            archivedAt: board.archivedAt,
            favoritedAt: board.favoritedAt,
            icon: board.icon,
          })
        }
        indexEntries.push(this.buildIndexEntry(board))
      }
    }

    // 异步保存索引文件（不阻塞返回）
    this.saveIndex(indexEntries).catch(() => {})

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

    const board = await MarkdownBoard.read(boardId)
    if (board) this.cache.set(boardId, board)
    return board
  }

  /**
   * 创建新看板
   */
  async createBoard(title: string, lanes?: Pick<Lane, 'title'>[], icon?: string): Promise<Board> {
    const now = new Date().toISOString()
    const boardId = this.createBoardId()

    // 如果没有指定图标，从图标库中随机选一个
    let selectedIcon = icon
    if (!selectedIcon) {
      try {
        const settingsStorage = SettingsStorage.getInstance()
        await settingsStorage.initialize()
        const iconSettings = await settingsStorage.getIconSettings()
        if (iconSettings.icons.length > 0) {
          const randomIndex = Math.floor(Math.random() * iconSettings.icons.length)
          selectedIcon = iconSettings.icons[randomIndex].url
        }
      } catch {
        // 忽略设置读取失败
      }
    }

    const defaultLanes = lanes && lanes.length > 0
      ? lanes
      : [
          { title: '待办' },
          { title: '进行中' },
          { title: '已完成' },
        ]

    const newBoard: Board = {
      id: boardId,
      title,
      createdAt: now,
      updatedAt: now,
      tags: [],
      icon: selectedIcon,
      lanes: defaultLanes.map((l, index) => ({
        id: this.createLaneId(boardId, index),
        boardId,
        title: l.title,
        position: index,
        createdAt: now,
        updatedAt: now,
        cards: [],
      })),
    }

    await MarkdownBoard.write(newBoard)
    this.cache.set(boardId, newBoard)
    await this.rebuildIndex()

    return newBoard
  }

  /**
   * 更新看板
   */
  async updateBoard(boardId: string, data: { title?: string; lanes?: Lane[]; archivedAt?: string | null; favoritedAt?: string | null; icon?: string | null }): Promise<Board | null> {
    const board = await this.getBoard(boardId)
    if (!board) return null

    const updated: Board = {
      ...board,
      ...data,
      updatedAt: new Date().toISOString(),
    }

    if (data.archivedAt === null) {
      delete updated.archivedAt
    }
    if (data.favoritedAt === null) {
      delete updated.favoritedAt
    }
    if (data.icon === null) {
      delete updated.icon
    }

    await MarkdownBoard.write(updated)
    this.cache.set(boardId, updated)
    await this.rebuildIndex()

    return updated
  }

  /**
   * 归档看板
   */
  async archiveBoard(boardId: string): Promise<Board | null> {
    return this.updateBoard(boardId, { archivedAt: new Date().toISOString() })
  }

  /**
   * 恢复看板
   */
  async unarchiveBoard(boardId: string): Promise<Board | null> {
    return this.updateBoard(boardId, { archivedAt: null })
  }

  /**
   * 收藏看板
   */
  async favoriteBoard(boardId: string): Promise<Board | null> {
    return this.updateBoard(boardId, { favoritedAt: new Date().toISOString() })
  }

  /**
   * 取消收藏看板
   */
  async unfavoriteBoard(boardId: string): Promise<Board | null> {
    return this.updateBoard(boardId, { favoritedAt: null })
  }

  /**
   * 添加操作日志到看板
   * 单看板最多保留 200 条日志，超出时淘汰最早的
   */
  async addOperationLog(boardId: string, log: OperationLogEntry): Promise<Board | null> {
    const board = await this.getBoard(boardId)
    if (!board) return null

    const logs = board.operationLogs || []
    const newLogs = [log, ...logs].slice(0, 200)

    const updated: Board = {
      ...board,
      operationLogs: newLogs,
      updatedAt: new Date().toISOString(),
    }

    await MarkdownBoard.write(updated)
    this.cache.set(boardId, updated)

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
    await this.rebuildIndex()

    return true
  }

  /**
   * 获取默认看板（保持兼容性）
   */
  async getDefaultBoard(): Promise<Board | null> {
    return this.getBoard('default-board')
  }

  /**
   * 获取操作日志
   */
  async getOperationLogs(boardId: string): Promise<OperationLogEntry[]> {
    const board = await this.getBoard(boardId)
    return board?.operationLogs || []
  }

  /**
   * 清空操作日志
   */
  async clearOperationLogs(boardId: string): Promise<Board | null> {
    const board = await this.getBoard(boardId)
    if (!board) return null

    const updated: Board = {
      ...board,
      operationLogs: [],
      updatedAt: new Date().toISOString(),
    }

    await MarkdownBoard.write(updated)
    this.cache.set(boardId, updated)

    return updated
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
    this.cache.set(boardId, updatedBoard)

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
    this.cache.set(boardId, updatedBoard)
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
    this.cache.set(boardId, updatedBoard)
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
    tags?: Tag[],
    attachments?: Attachment[],
    dueDate?: string,
    priority?: CardPriority
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
      attachments: attachments || [],
      dueDate,
      priority,
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
    this.cache.set(boardId, updatedBoard)

    return newCard
  }

  /**
   * 更新卡片
   */
  async updateCard(boardId: string, cardId: string, data: { title?: string; description?: string; tags?: Tag[]; attachments?: Attachment[]; dueDate?: string; priority?: CardPriority }): Promise<void> {
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
        this.cache.set(boardId, updatedBoard)
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
    this.cache.set(boardId, updatedBoard)
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
        const newCards = [...lane.cards, movedCard]
        // 按 position 排序，确保数组顺序与位置一致
        newCards.sort((a, b) => a.position - b.position)
        updatedLanes.push({
          ...lane,
          cards: newCards,
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
    this.cache.set(boardId, updatedBoard)
  }

  /**
   * 批量移动卡片
   */
  async batchMoveCards(boardId: string, cardIds: string[], toLaneId: string): Promise<void> {
    const board = await this.getBoard(boardId)
    if (!board) throw new Error('Board not found')

    const now = new Date().toISOString()
    const targetLane = board.lanes.find((l) => l.id === toLaneId)
    if (!targetLane) throw new Error('Lane not found')

    const cardsToMove: Card[] = []
    for (const cardId of cardIds) {
      for (const lane of board.lanes) {
        const card = lane.cards.find((c) => c.id === cardId)
        if (card) {
          cardsToMove.push({ ...card, laneId: toLaneId, updatedAt: now })
          break
        }
      }
    }

    if (cardsToMove.length === 0) throw new Error('No cards found to move')

    const updatedLanes: Lane[] = board.lanes.map((lane) => {
      if (lane.id === toLaneId) {
        const existingIds = new Set(lane.cards.map((c) => c.id))
        const newCards = [...lane.cards]
        for (const card of cardsToMove) {
          if (!existingIds.has(card.id)) {
            newCards.push(card)
          }
        }
        return { ...lane, cards: newCards, updatedAt: now }
      }
      return {
        ...lane,
        cards: lane.cards.filter((c) => !cardIds.includes(c.id)),
        updatedAt: now,
      }
    })

    const updatedBoard: Board = {
      ...board,
      lanes: updatedLanes,
      updatedAt: now,
    }

    await MarkdownBoard.write(updatedBoard)
    this.cache.set(boardId, updatedBoard)
  }

  /**
   * 批量删除卡片
   */
  async batchDeleteCards(boardId: string, cardIds: string[]): Promise<void> {
    const board = await this.getBoard(boardId)
    if (!board) throw new Error('Board not found')

    const now = new Date().toISOString()
    const idSet = new Set(cardIds)

    const updatedLanes: Lane[] = board.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.filter((c) => !idSet.has(c.id)),
      updatedAt: now,
    }))

    const updatedBoard: Board = {
      ...board,
      lanes: updatedLanes,
      updatedAt: now,
    }

    await MarkdownBoard.write(updatedBoard)
    this.cache.set(boardId, updatedBoard)
  }

  /**
   * 批量更新卡片标签
   */
  async batchUpdateCardTags(boardId: string, cardIds: string[], addTags: Tag[], removeTagIds: string[]): Promise<void> {
    const board = await this.getBoard(boardId)
    if (!board) throw new Error('Board not found')

    const now = new Date().toISOString()
    const idSet = new Set(cardIds)
    const removeSet = new Set(removeTagIds)

    const updatedLanes: Lane[] = board.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.map((card) => {
        if (!idSet.has(card.id)) return card
        let tags = [...(card.tags || [])]
        tags = tags.filter((t) => !removeSet.has(t.id))
        const existingIds = new Set(tags.map((t) => t.id))
        for (const tag of addTags) {
          if (!existingIds.has(tag.id)) {
            tags.push(tag)
          }
        }
        return { ...card, tags, updatedAt: now }
      }),
      updatedAt: now,
    }))

    const updatedBoard: Board = {
      ...board,
      lanes: updatedLanes,
      updatedAt: now,
    }

    await MarkdownBoard.write(updatedBoard)
    this.cache.set(boardId, updatedBoard)
  }

  /**
   * ========== 私有辅助方法 ==========
   */

  /**
   * 从索引文件加载看板列表
   */
  private async loadIndex(): Promise<BoardIndexEntry[] | null> {
    try {
      const content = await fs.readFile(INDEX_FILE, 'utf-8')
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed?.boards)) {
        return parsed.boards as BoardIndexEntry[]
      }
      return null
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * 保存看板列表到索引文件
   */
  private async saveIndex(boards: BoardIndexEntry[]): Promise<void> {
    const content = JSON.stringify({ boards, updatedAt: new Date().toISOString() }, null, 2)
    await fs.writeFile(INDEX_FILE, content, 'utf-8')
  }

  /**
   * 构建看板索引条目
   */
  private buildIndexEntry(board: Board): BoardIndexEntry {
    return {
      id: board.id,
      title: board.title,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      archivedAt: board.archivedAt,
      favoritedAt: board.favoritedAt,
      icon: board.icon,
      cardCount: board.lanes.reduce((sum, lane) => sum + lane.cards.length, 0),
    }
  }

  /**
   * 重建索引文件
   */
  private async rebuildIndex(): Promise<void> {
    try {
      const boardIds = await MarkdownBoard.listAll()
      const entries: BoardIndexEntry[] = []

      for (const boardId of boardIds) {
        const board = await this.getBoard(boardId)
        if (board) {
          entries.push(this.buildIndexEntry(board))
        }
      }

      await this.saveIndex(entries)
    } catch {
      // 索引重建失败不应影响主流程
    }
  }

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
    getBoards: (includeArchived?: boolean) => storage.getBoards(includeArchived),
    getBoard: (boardId: string) => storage.getBoard(boardId),
    createBoard: (title: string, lanes?: Pick<Lane, 'title'>[], icon?: string) => storage.createBoard(title, lanes, icon),
    updateBoard: (boardId: string, data: { title?: string; lanes?: Lane[]; archivedAt?: string | null; icon?: string | null }) => storage.updateBoard(boardId, data),
    deleteBoard: (boardId: string) => storage.deleteBoard(boardId),
    getDefaultBoard: () => storage.getDefaultBoard(),
    getTags: () => storage.getTags(),

    // 归档
    archiveBoard: (boardId: string) => storage.archiveBoard(boardId),
    unarchiveBoard: (boardId: string) => storage.unarchiveBoard(boardId),

    // 操作日志
    addOperationLog: (boardId: string, log: OperationLogEntry) => storage.addOperationLog(boardId, log),
    getOperationLogs: (boardId: string) => storage.getOperationLogs(boardId),
    clearOperationLogs: (boardId: string) => storage.clearOperationLogs(boardId),
    updateLane: (boardId: string, laneId: string, data: { title?: string }) =>
      storage.updateLane(boardId, laneId, data),
    deleteLane: (boardId: string, laneId: string) => storage.deleteLane(boardId, laneId),

    // 卡片操作
    createCard: (boardId: string, laneId: string, title: string, description?: string, tags?: Tag[], attachments?: Attachment[], dueDate?: string, priority?: CardPriority) =>
      storage.createCard(boardId, laneId, title, description, tags, attachments, dueDate, priority),
    updateCard: (boardId: string, cardId: string, data: { title?: string; description?: string; tags?: Tag[]; attachments?: Attachment[]; dueDate?: string; priority?: CardPriority }) =>
      storage.updateCard(boardId, cardId, data),
    deleteCard: (boardId: string, cardId: string) => storage.deleteCard(boardId, cardId),
    moveCard: (boardId: string, cardId: string, toLaneId: string, newPosition: number) =>
      storage.moveCard(boardId, cardId, toLaneId, newPosition),
  }
}
