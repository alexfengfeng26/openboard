/**
 * 看板内存缓存 - 提升性能
 * 支持 TTL（自动过期）和 LRU（最近最少使用）淘汰策略
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
 * 使用 Map 实现 LRU，支持 TTL（自动过期）
 */
export class BoardCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly DEFAULT_TTL = 300000 // 5 分钟（毫秒）
  private readonly ttl: number
  private readonly maxSize: number

  constructor(ttl?: number, maxSize = 50) {
    this.ttl = ttl ?? this.DEFAULT_TTL
    this.maxSize = maxSize
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

    // LRU: 移到最新
    this.cache.delete(boardId)
    this.cache.set(boardId, entry)

    return entry.data
  }

  /**
   * 设置看板缓存
   */
  set(boardId: string, board: Board): void {
    // 如果 key 已存在，先删除再设置（更新顺序）
    if (this.cache.has(boardId)) {
      this.cache.delete(boardId)
    }

    // 如果容量超限，删除最久未使用的（Map 的第一个 key）
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

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
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
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
