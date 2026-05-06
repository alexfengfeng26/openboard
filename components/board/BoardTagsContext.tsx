'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Tag } from '@/lib/db'

const BoardTagsContext = createContext<Tag[]>([])

export function BoardTagsProvider({ tags, children }: { tags: Tag[]; children: ReactNode }) {
  return <BoardTagsContext.Provider value={tags}>{children}</BoardTagsContext.Provider>
}

export function useBoardTags() {
  return useContext(BoardTagsContext)
}
