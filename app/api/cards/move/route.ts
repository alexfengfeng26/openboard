import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { boardId, cardId, toLaneId, newPosition } = body

    if (!boardId || !cardId || !toLaneId || newPosition === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await dbHelpers.moveCard(boardId, cardId, toLaneId, newPosition)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error moving card:', error)
    return NextResponse.json({ error: 'Failed to move card' }, { status: 500 })
  }
}
