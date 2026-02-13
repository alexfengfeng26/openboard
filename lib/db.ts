/**
 * 数据库层 - 使用 Markdown 文件存储
 */

import type { Data } from '@/types'
import { getStorage, resetStorage, dbHelpersWrapper } from './storage/StorageAdapter'

// 导出类型定义
export type { Tag, Card, Lane, Board, Data } from '@/types'

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
 * 数据库操作辅助函数
 *
 * 为了向后兼容，创建一个懒加载的代理对象
 * 所有方法签名保持不变，确保现有代码无需修改
 */
let cachedHelpers: Awaited<ReturnType<typeof dbHelpersWrapper>> | null = null

async function getHelpers() {
  if (!cachedHelpers) {
    cachedHelpers = await dbHelpersWrapper()
  }
  return cachedHelpers
}

export const dbHelpers = new Proxy({} as Awaited<ReturnType<typeof dbHelpersWrapper>>, {
  get(_target, prop: string) {
    return async (...args: any[]) => {
      const helpers = await getHelpers()
      const method = helpers[prop as keyof typeof helpers]
      if (typeof method === 'function') {
        return (method as any)(...args)
      }
      throw new Error(`Method ${prop} not found on dbHelpers`)
    }
  }
})
