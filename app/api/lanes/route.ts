import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { boardId, title } = body

    if (!boardId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const lane = await dbHelpers.createLane(boardId, title)

    return NextResponse.json({ success: true, data: lane })
  } catch (error) {
    console.error('Error creating lane:', error)
    return NextResponse.json({ error: 'Failed to create lane' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const laneId = searchParams.get('id')
    const boardId = searchParams.get('boardId')

    if (!laneId || !boardId) {
      return NextResponse.json({ error: 'Missing lane id or board id' }, { status: 400 })
    }

    await dbHelpers.deleteLane(boardId, laneId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lane:', error)
    return NextResponse.json({ error: 'Failed to delete lane' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { boardId, laneId, title } = body

    if (!boardId || !laneId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await dbHelpers.updateLane(boardId, laneId, { title })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating lane:', error)
    return NextResponse.json({ error: 'Failed to update lane' }, { status: 500 })
  }
}
