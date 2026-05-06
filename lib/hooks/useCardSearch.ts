'use client'

import { useState, useMemo, useCallback } from 'react'
import type { Board, Card } from '@/lib/db'

export interface SearchFilters {
  query: string
  tagIds: string[]
  laneIds: string[]
}

function cardMatchesFilter(card: Card, filters: SearchFilters): boolean {
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

export function filterCards(board: Board, filters: SearchFilters): Board {
  const hasFilters =
    filters.query.trim().length > 0 ||
    filters.tagIds.length > 0 ||
    filters.laneIds.length > 0

  if (!hasFilters) return board

  return {
    ...board,
    lanes: board.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.map((card) => ({
        ...card,
        _matches: cardMatchesFilter(card, filters),
      })) as Card[],
    })),
  }
}

export function useCardSearch(board: Board) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    tagIds: [],
    laneIds: [],
  })

  const filteredBoard = useMemo(() => filterCards(board, filters), [board, filters])

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

  return {
    filters,
    setFilters,
    setQuery,
    toggleTag,
    toggleLane,
    filteredBoard,
    resultCount,
    clearFilters,
  }
}
