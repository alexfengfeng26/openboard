/**
 * 看板内存缓存 - 提升性能
 */

import type { Board } from '@/types'

/**
 * 缓存条目
 */
interface CacheEntry {
  data: Board
  timestamp: number
}

/**
 * 看板缓存类
 * 使用简单的 Map 实现，支持 TTL（自动过期）
 */
export class BoardCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly DEFAULT_TTL = 30000 // 30 秒（毫秒）
  private readonly ttl: number

  constructor(ttl?: number) {
    this.ttl = ttl ?? this.DEFAULT_TTL
  }

  /**
   * 获取看板
   * @returns 看板数据，如果不存在或已过期则返回 null
   */
  get(boardId: string): Board | null {
    const entry = this.cache.get(boardId)

    if (!entry) {
      return null
    }

    const now = Date.now()
    const isExpired = now - entry.timestamp > this.ttl

    if (isExpired) {
      this.cache.delete(boardId)
      return null
    }

    return entry.data
  }

  /**
   * 设置看板缓存
   */
  set(boardId: string, board: Board): void {
    this.cache.set(boardId, {
      data: board,
      timestamp: Date.now(),
    })
  }

  /**
   * 删除看板缓存
   */
  delete(boardId: string): void {
    this.cache.delete(boardId)
  }

  /**
   * 使指定看板的缓存失效
   */
  invalidate(boardId: string): void {
    this.delete(boardId)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * 检查缓存是否存在且有效
   */
  has(boardId: string): boolean {
    const entry = this.cache.get(boardId)
    if (!entry) {
      return false
    }

    const now = Date.now()
    const isExpired = now - entry.timestamp > this.ttl

    return !isExpired
  }

  /**
   * 清理过期的缓存条目
   * @returns 清理的条目数量
   */
  cleanup(): number {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [boardId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        expiredKeys.push(boardId)
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key)
    }

    return expiredKeys.length
  }
}
