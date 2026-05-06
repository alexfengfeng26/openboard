import { NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage/StorageAdapter'
import type { Tag } from '@/lib/db'

interface BatchUpdateTagsRequestBody {
  boardId: string
  cardIds: string[]
  addTags?: Tag[]
  removeTagIds?: string[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as BatchUpdateTagsRequestBody
    const { boardId, cardIds, addTags, removeTagIds } = body

    if (!boardId || !Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const storage = await getStorage()
    await storage.batchUpdateCardTags(boardId, cardIds, addTags || [], removeTagIds || [])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error batch updating card tags:', error)
    const message = error instanceof Error ? error.message : 'Failed to batch update card tags'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
