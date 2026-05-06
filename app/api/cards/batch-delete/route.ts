import { NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage/StorageAdapter'

interface BatchDeleteRequestBody {
  boardId: string
  cardIds: string[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as BatchDeleteRequestBody
    const { boardId, cardIds } = body

    if (!boardId || !Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const storage = await getStorage()
    await storage.batchDeleteCards(boardId, cardIds)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error batch deleting cards:', error)
    const message = error instanceof Error ? error.message : 'Failed to batch delete cards'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
