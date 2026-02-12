import { NextResponse } from 'next/server'
import { dbHelpers, TAG_COLORS } from '@/lib/db'
import type { Tag } from '@/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('boardId') || 'default-board'

    const board = await dbHelpers.getBoard(boardId)

    // 如果找到看板且有标签，返回看板标签
    if (board?.tags) {
      return NextResponse.json({ success: true, data: board.tags })
    }

    // 否则返回预设标签
    const defaultTags: Tag[] = TAG_COLORS.map((t, i) => ({
      id: `tag-${i}`,
      name: t.name,
      color: t.color
    }))

    return NextResponse.json({ success: true, data: defaultTags })
  } catch (error) {
    console.error('Error fetching tags:', error)
    // 发生错误时返回预设标签
    const defaultTags: Tag[] = TAG_COLORS.map((t, i) => ({
      id: `tag-${i}`,
      name: t.name,
      color: t.color
    }))

    return NextResponse.json({ success: true, data: defaultTags })
  }
}
