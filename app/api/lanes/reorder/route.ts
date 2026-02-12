import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'
import type { Board } from '@/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { boardId, laneIds } = body

    if (!boardId || !Array.isArray(laneIds)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 获取完整看板数据
    const board = await dbHelpers.getBoard(boardId)
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }

    // 创建新的 lanes 数组，按新顺序排列
    const reorderedLanes = board.lanes.map((lane) => {
      const index = laneIds.indexOf(lane.id)
      const newPosition = index === -1 ? 0 : index

      return {
        ...lane,
        position: newPosition * 1000,
        updatedAt: new Date().toISOString(),
      }
    })

    const updatedBoard: Board = {
      ...board,
      lanes: reorderedLanes,
      updatedAt: new Date().toISOString(),
    }

    await dbHelpers.updateBoard(boardId, { title: board.title })

    return NextResponse.json({ success: true, data: updatedBoard })
  } catch (error) {
    console.error('Error reordering lanes:', error)
    return NextResponse.json({ error: 'Failed to reorder lanes' }, { status: 500 })
  }
}
