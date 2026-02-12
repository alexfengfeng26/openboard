import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'
import type { Board, Lane, Card } from '@/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { boardId, laneId, cardIds } = body

    if (!boardId || !laneId || !Array.isArray(cardIds)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = await dbHelpers

    // 获取完整看板数据
    const board = await db.getBoard(boardId)
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }

    // 查找目标列表
    const targetLane: Lane | undefined = board.lanes.find((l: Lane) => l.id === laneId)
    if (!targetLane) {
      return NextResponse.json({ error: 'Lane not found' }, { status: 404 })
    }

    // 类型守卫：确保 lane.cards 存在
    if (!targetLane.cards || targetLane.cards.length === 0) {
      return NextResponse.json({ error: 'Lane has no cards' }, { status: 400 })
    }

    // 按新的顺序重新排列卡片
    const reorderedCards: Card[] = []
    for (let i = 0; i < cardIds.length; i++) {
      const cardIndex = targetLane.cards.findIndex((c: Card) => c.id === cardIds[i])
      if (cardIndex !== -1) {
        const card = targetLane.cards[cardIndex]
        card.position = i * 1000 // 使用固定步长
        card.updatedAt = new Date().toISOString()
        reorderedCards.push(card)
      }
    }

    const updatedLane: Lane = {
      ...targetLane,
      cards: reorderedCards.length > 0 ? reorderedCards : targetLane.cards,
      updatedAt: new Date().toISOString(),
    }

    const updatedBoard: Board = {
      ...board,
      lanes: board.lanes.map((l: Lane) => (l.id === laneId ? updatedLane : l)),
      updatedAt: new Date().toISOString(),
    }

    await db.updateBoard(boardId, { title: board.title })

    return NextResponse.json({ success: true, data: updatedLane })
  } catch (error) {
    console.error('Error reordering cards:', error)
    return NextResponse.json({ error: 'Failed to reorder cards' }, { status: 500 })
  }
}
