'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import type { Board, Card } from '@/lib/db'

export interface SearchFilters {
  query: string
  tagIds: string[]
  laneIds: string[]
}

export type SearchMode = 'keyword' | 'semantic'

function cardMatchesKeywordFilter(card: Card, filters: SearchFilters): boolean {
  if (filters.query.trim()) {
    const q = filters.query.toLowerCase()
    const inTitle = card.title.toLowerCase().includes(q)
    const inDesc = card.description?.toLowerCase().includes(q) ?? false
    if (!inTitle && !inDesc) return false
  }

  if (filters.tagIds.length > 0) {
    const cardTagIds = new Set(card.tags?.map((t) => t.id) ?? [])
    const hasAnyTag = filters.tagIds.some((id) => cardTagIds.has(id))
    if (!hasAnyTag) return false
  }

  if (filters.laneIds.length > 0) {
    if (!filters.laneIds.includes(card.laneId)) return false
  }

  return true
}

function cardMatchesSemanticFilter(
  card: Card,
  semanticMatches: Set<string>,
  tagIds: string[],
  laneIds: string[]
): boolean {
  if (!semanticMatches.has(card.id)) return false

  if (tagIds.length > 0) {
    const cardTagIds = new Set(card.tags?.map((t) => t.id) ?? [])
    const hasAnyTag = tagIds.some((id) => cardTagIds.has(id))
    if (!hasAnyTag) return false
  }

  if (laneIds.length > 0) {
    if (!laneIds.includes(card.laneId)) return false
  }

  return true
}

export function useCardSearch(board: Board) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    tagIds: [],
    laneIds: [],
  })
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword')
  const [semanticMatches, setSemanticMatches] = useState<Set<string>>(new Set())
  const [semanticLoading, setSemanticLoading] = useState(false)
  const [semanticError, setSemanticError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const filteredBoard = useMemo(() => {
    const hasFilters =
      filters.query.trim().length > 0 ||
      filters.tagIds.length > 0 ||
      filters.laneIds.length > 0

    if (!hasFilters && searchMode === 'keyword') return board
    if (searchMode === 'semantic' && semanticMatches.size === 0 && !semanticLoading) {
      // 语义模式下如果没有匹配结果且不在加载中，返回空板（但保持列表结构）
      if (filters.query.trim()) {
        return {
          ...board,
          lanes: board.lanes.map((lane) => ({
            ...lane,
            cards: [],
          })),
        }
      }
      return board
    }

    return {
      ...board,
      lanes: board.lanes.map((lane) => {
        if (searchMode === 'semantic') {
          // 语义搜索：直接过滤掉不匹配的卡片
          const filteredCards = lane.cards.filter((card) =>
            cardMatchesSemanticFilter(card, semanticMatches, filters.tagIds, filters.laneIds)
          )
          return {
            ...lane,
            cards: filteredCards,
          }
        }
        // 关键词搜索：保留所有卡片，标记匹配状态
        return {
          ...lane,
          cards: lane.cards.map((card) => ({
            ...card,
            _matches: cardMatchesKeywordFilter(card, filters),
          })) as Card[],
        }
      }),
    }
  }, [board, filters, searchMode, semanticMatches, semanticLoading])

  const resultCount = useMemo(() => {
    let count = 0
    for (const lane of filteredBoard.lanes) {
      for (const card of lane.cards) {
        if ((card as Card & { _matches?: boolean })._matches !== false) {
          count++
        }
      }
    }
    return count
  }, [filteredBoard])

  const clearFilters = useCallback(() => {
    setFilters({ query: '', tagIds: [], laneIds: [] })
    setSemanticMatches(new Set())
    setSemanticError(null)
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const setQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, query }))
  }, [])

  const toggleTag = useCallback((tagId: string) => {
    setFilters((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }))
  }, [])

  const toggleLane = useCallback((laneId: string) => {
    setFilters((prev) => ({
      ...prev,
      laneIds: prev.laneIds.includes(laneId)
        ? prev.laneIds.filter((id) => id !== laneId)
        : [...prev.laneIds, laneId],
    }))
  }, [])

  /**
   * 切换搜索模式
   */
  const switchSearchMode = useCallback((mode: SearchMode) => {
    setSearchMode(mode)
    setFilters({ query: '', tagIds: [], laneIds: [] })
    setSemanticMatches(new Set())
    setSemanticError(null)
    setSemanticLoading(false)
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  /**
   * 执行语义搜索（带防抖）
   */
  const performSemanticSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSemanticMatches(new Set())
        setSemanticError(null)
        return
      }

      // 取消之前的请求和定时器
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (abortRef.current) {
        abortRef.current.abort()
      }

      setSemanticLoading(true)
      setSemanticError(null)

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController()
        abortRef.current = controller

        try {
          const response = await fetch('/api/ai/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              boardId: board.id,
              boardTitle: board.title,
              query,
              lanes: board.lanes.map((lane) => ({
                id: lane.id,
                title: lane.title,
                cards: lane.cards.map((card) => ({
                  id: card.id,
                  title: card.title,
                  description: card.description,
                  position: card.position,
                  createdAt: card.createdAt,
                  updatedAt: card.updatedAt,
                  tags: card.tags,
                })),
              })),
              tags: board.tags,
            }),
            signal: controller.signal,
          })

          const data = await response.json()

          if (!response.ok || !data.success) {
            throw new Error(data.error || '搜索失败')
          }

          setSemanticMatches(new Set(data.cardIds || []))
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // 忽略取消的请求
            return
          }
          const message = err instanceof Error ? err.message : '语义搜索出错'
          setSemanticError(message)
          setSemanticMatches(new Set())
        } finally {
          setSemanticLoading(false)
        }
      }, 600)
    },
    [board]
  )

  return {
    filters,
    setFilters,
    setQuery,
    toggleTag,
    toggleLane,
    filteredBoard,
    resultCount,
    clearFilters,
    searchMode,
    switchSearchMode,
    semanticLoading,
    semanticError,
    performSemanticSearch,
  }
}
