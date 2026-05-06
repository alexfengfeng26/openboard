import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BoardCache } from './BoardCache'
import type { Board } from '@/types'

function createBoard(id: string): Board {
  return {
    id,
    title: `Board ${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lanes: [],
    tags: [],
  }
}

describe('BoardCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('set / get basic operations', () => {
    const cache = new BoardCache()
    const board = createBoard('board-1')
    cache.set('board-1', board)
    expect(cache.get('board-1')).toEqual(board)
  })

  it('returns null for non-existent key', () => {
    const cache = new BoardCache()
    expect(cache.get('non-existent')).toBeNull()
  })

  it('auto cleans expired entries by TTL', () => {
    const cache = new BoardCache(1000, 50) // 1s TTL
    const board = createBoard('board-1')
    cache.set('board-1', board)
    expect(cache.get('board-1')).toEqual(board)

    vi.advanceTimersByTime(1500)
    expect(cache.get('board-1')).toBeNull()
  })

  it('LRU eviction when maxSize exceeded', () => {
    const cache = new BoardCache(60000, 3)
    cache.set('board-1', createBoard('board-1'))
    cache.set('board-2', createBoard('board-2'))
    cache.set('board-3', createBoard('board-3'))

    // Access board-1 to make it recently used
    cache.get('board-1')

    // Add board-4, should evict board-2 (least recently used)
    cache.set('board-4', createBoard('board-4'))

    expect(cache.get('board-1')).not.toBeNull()
    expect(cache.get('board-2')).toBeNull()
    expect(cache.get('board-3')).not.toBeNull()
    expect(cache.get('board-4')).not.toBeNull()
  })

  it('cleanup removes expired entries', () => {
    const cache = new BoardCache(1000, 50)
    cache.set('board-1', createBoard('board-1'))
    cache.set('board-2', createBoard('board-2'))

    vi.advanceTimersByTime(500)
    cache.set('board-3', createBoard('board-3')) // not expired yet

    vi.advanceTimersByTime(600) // now board-1 and board-2 are expired

    const cleaned = cache.cleanup()
    expect(cleaned).toBe(2)
    expect(cache.get('board-1')).toBeNull()
    expect(cache.get('board-2')).toBeNull()
    expect(cache.get('board-3')).not.toBeNull()
  })

  it('getStats returns correct statistics', () => {
    const cache = new BoardCache(60000, 10)
    cache.set('board-1', createBoard('board-1'))
    cache.set('board-2', createBoard('board-2'))

    const stats = cache.getStats()
    expect(stats.size).toBe(2)
    expect(stats.maxSize).toBe(10)
    expect(stats.keys).toEqual(['board-1', 'board-2'])
  })
})
