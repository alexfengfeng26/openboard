import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'
import type { Card, Tag } from '@/lib/db'

interface CreateCardRequestBody {
  boardId: string
  laneId: string
  title: string
  description?: string
  tags?: Tag[]
}

interface UpdateCardRequestBody {
  cardId?: string
  boardId?: string
  title?: string
  description?: string
  tags?: Tag[]
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as CreateCardRequestBody
    const { boardId, laneId, title, description, tags } = body

    if (!boardId || !laneId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const card = await dbHelpers.createCard(boardId, laneId, title, description, tags)

    return NextResponse.json({ success: true, data: card })
  } catch (error) {
    console.error('Error creating card:', error)
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get('id') || searchParams.get('cardId')
    const boardId = searchParams.get('boardId')

    if (!cardId || !boardId) {
      return NextResponse.json({ error: 'Missing card id or board id' }, { status: 400 })
    }

    await dbHelpers.deleteCard(boardId, cardId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting card:', error)
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const body = await request.json().catch(() => ({})) as UpdateCardRequestBody
    const bodyCardId = typeof body.cardId === 'string' ? body.cardId : null
    const cardId = bodyCardId || searchParams.get('cardId') || searchParams.get('id')
    const { cardId: _cardId, ...data } = body
    const boardId = body.boardId || searchParams.get('boardId')

    if (!cardId || !boardId) {
      return NextResponse.json({ error: 'Missing card id or board id' }, { status: 400 })
    }

    await dbHelpers.updateCard(boardId, cardId, data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating card:', error)
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 })
  }
}
