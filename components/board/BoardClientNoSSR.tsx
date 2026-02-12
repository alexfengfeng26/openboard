'use client'

import type { Board } from '@/lib/db'
import dynamic from 'next/dynamic'

// 动态导入 BoardClient，禁用 SSR 以避免 @dnd-kit hydration 问题
const BoardClient = dynamic(() => import('./BoardClient').then(mod => ({ default: mod.BoardClient })), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-muted-foreground">加载看板...</p>
      </div>
    </div>
  ),
})

export function BoardClientNoSSR({
  initialBoard,
  initialBoards,
}: {
  initialBoard: Board
  initialBoards: Array<{ id: string; title: string; createdAt: string; updatedAt: string }>
}) {
  return (
    <div suppressHydrationWarning>
      <BoardClient initialBoard={initialBoard} initialBoards={initialBoards} />
    </div>
  )
}
