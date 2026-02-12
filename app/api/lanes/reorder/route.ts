import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { Board } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { boardId, laneIds } = body

    if (!boardId || !Array.isArray(laneIds)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = await getDb()
    const board = db.data?.boards?.find((b: Board) => b.id === boardId)
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }

    // 创建一个新的 lanes 数组，按新顺序排列
    const reorderedLanes: typeof board.lanes = []
    for (let i = 0; i < laneIds.length; i++) {
      const lane = board.lanes.find((l) => l.id === laneIds[i])
      if (lane) {
        lane.position = i * 1000 // 使用固定步长
        lane.updatedAt = new Date().toISOString()
        reorderedLanes.push(lane)
      }
    }

    board.lanes = reorderedLanes
    board.updatedAt = new Date().toISOString()

    await db.write()

    return NextResponse.json({ success: true, data: board })
  } catch (error) {
    console.error('Error reordering lanes:', error)
    return NextResponse.json({ error: 'Failed to reorder lanes' }, { status: 500 })
  }
}
