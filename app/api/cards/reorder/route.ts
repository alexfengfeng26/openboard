import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { boardId, laneId, cardIds } = body

    if (!boardId || !laneId || !Array.isArray(cardIds)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = await getDb()
    const board = db.data?.boards?.find((b) => b.id === boardId)
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }

    const lane = board.lanes.find((l) => l.id === laneId)
    if (!lane) {
      return NextResponse.json({ error: 'Lane not found' }, { status: 404 })
    }

    // 按新的顺序重新排列卡片
    const reorderedCards: typeof lane.cards = []
    for (let i = 0; i < cardIds.length; i++) {
      const card = lane.cards?.find((c) => c.id === cardIds[i])
      if (card) {
        card.position = i * 1000 // 使用固定步长
        card.updatedAt = new Date().toISOString()
        reorderedCards.push(card)
      }
    }

    lane.cards = reorderedCards
    lane.updatedAt = new Date().toISOString()
    board.updatedAt = new Date().toISOString()

    await db.write()

    return NextResponse.json({ success: true, data: lane })
  } catch (error) {
    console.error('Error reordering cards:', error)
    return NextResponse.json({ error: 'Failed to reorder cards' }, { status: 500 })
  }
}
