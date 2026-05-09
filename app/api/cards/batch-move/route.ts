import { NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage/StorageAdapter'
import { triggerAutomation } from '@/lib/automation/trigger'

interface BatchMoveRequestBody {
  boardId: string
  cardIds: string[]
  toLaneId: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as BatchMoveRequestBody
    const { boardId, cardIds, toLaneId } = body

    if (!boardId || !Array.isArray(cardIds) || cardIds.length === 0 || !toLaneId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const storage = await getStorage()
    const board = await storage.getBoard(boardId)
    await storage.batchMoveCards(boardId, cardIds, toLaneId)

    // 异步触发自动化规则
    for (const cardId of cardIds) {
      const card = board?.lanes.flatMap((l) => l.cards).find((c) => c.id === cardId)
      void triggerAutomation('card_moved', {
        boardId,
        cardId,
        fromLaneId: card?.laneId,
        toLaneId,
        cardTitle: card?.title,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error batch moving cards:', error)
    const message = error instanceof Error ? error.message : 'Failed to batch move cards'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
