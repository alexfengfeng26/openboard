/**
 * 数据库层 - 使用 Markdown 文件存储
 */

import type { Data } from '@/types'
import { getStorage, resetStorage, dbHelpersWrapper } from './storage/StorageAdapter'

// 导出类型定义
export type { Tag, Card, Lane, Board, Data, Attachment, CardPriority } from '@/types'

// 导出新的存储适配器
export { getStorage, resetStorage, dbHelpersWrapper } from './storage/StorageAdapter'

/**
 * 创建实体 ID（保持兼容性）
 */
export function createEntityId(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : null
  if (uuid) return `${prefix}-${uuid}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * 确保卡片 ID 唯一（保留兼容性）
 * 注意：新的 Markdown 存储会自动处理 ID 唯一性，此函数主要用于兼容
 */
export function ensureUniqueCardIds(data: Data): boolean {
  // Markdown 存储通过时间戳保证唯一性，无需特殊处理
  return true
}

/**
 * 初始化数据库（兼容接口）
 * @deprecated 此函数保留用于向后兼容，实际初始化由 StorageAdapter.initialize() 处理
 */
export async function createDb() {
  // 自动初始化由 StorageAdapter 处理
  const storage = await getStorage()
  return storage as any
}

/**
 * 获取数据库实例（兼容接口）
 * @deprecated 使用 getStorage() 替代
 */
export async function getDb() {
  // 导入新的存储适配器
  const { dbHelpersWrapper } = await import('./storage/StorageAdapter')
  return await dbHelpersWrapper()
}

/**
 * 重置数据库实例（兼容接口）
 */
export function resetDb() {
  resetStorage()
}

/**
 * 数据库操作辅助函数接口
 */
export interface DbHelpers {
  getBoards: (includeArchived?: boolean) => Promise<Array<{ id: string; title: string; createdAt: string; updatedAt: string; archivedAt?: string; favoritedAt?: string }>>
  getBoard: (boardId: string) => Promise<import('@/types').Board | null>
  createBoard: (title: string, lanes?: Pick<import('@/types').Lane, 'title'>[], icon?: string) => Promise<import('@/types').Board>
  updateBoard: (boardId: string, data: { title?: string; lanes?: import('@/types').Lane[]; archivedAt?: string | null; icon?: string | null }) => Promise<import('@/types').Board | null>
  deleteBoard: (boardId: string) => Promise<boolean>
  archiveBoard: (boardId: string) => Promise<import('@/types').Board | null>
  unarchiveBoard: (boardId: string) => Promise<import('@/types').Board | null>
  getDefaultBoard: () => Promise<import('@/types').Board | null>
  getTags: () => Promise<import('@/types').Tag[]>
  addOperationLog: (boardId: string, log: import('@/types/ai-tools.types').OperationLogEntry) => Promise<import('@/types').Board | null>
  getOperationLogs: (boardId: string) => Promise<import('@/types/ai-tools.types').OperationLogEntry[]>
  clearOperationLogs: (boardId: string) => Promise<import('@/types').Board | null>
  createLane: (boardId: string, title: string) => Promise<import('@/types').Lane>
  updateLane: (boardId: string, laneId: string, data: { title?: string }) => Promise<void>
  deleteLane: (boardId: string, laneId: string) => Promise<void>
  createCard: (boardId: string, laneId: string, title: string, description?: string, tags?: import('@/types').Tag[], attachments?: import('@/types').Attachment[], dueDate?: string, priority?: import('@/types').CardPriority) => Promise<import('@/types').Card>
  updateCard: (boardId: string, cardId: string, data: { title?: string; description?: string; tags?: import('@/types').Tag[]; attachments?: import('@/types').Attachment[]; dueDate?: string; priority?: import('@/types').CardPriority }) => Promise<void>
  deleteCard: (boardId: string, cardId: string) => Promise<void>
  moveCard: (boardId: string, cardId: string, toLaneId: string, newPosition: number) => Promise<void>
  batchUpdateCardTags: (boardId: string, cardIds: string[], addTags: import('@/types').Tag[], removeTagIds: string[]) => Promise<void>
}

/**
 * 数据库操作辅助函数
 *
 * 为了向后兼容，创建一个懒加载的代理对象
 * 所有方法签名保持不变，确保现有代码无需修改
 */
export const dbHelpers = new Proxy({} as DbHelpers, {
  get(_target, prop: string) {
    return async (...args: any[]) => {
      const helpers = await dbHelpersWrapper()
      const method = helpers[prop as keyof typeof helpers]
      if (typeof method === 'function') {
        return (method as any)(...args)
      }
      throw new Error(`Method ${prop} not found on dbHelpers`)
    }
  },
})
