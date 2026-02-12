import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'

// GET /api/boards/[boardId] - 获取单个看板详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params

  try {
    const board = await dbHelpers.getBoard(boardId)

    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: board })
  } catch (error) {
    console.error('Error fetching board:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch board' },
      { status: 500 }
    )
  }
}

// PATCH /api/boards/[boardId] - 更新看板
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params

  try {
    const body = await request.json()
    const { title } = body

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Invalid title' },
        { status: 400 }
      )
    }

    const board = await dbHelpers.updateBoard(boardId, { title })

    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: board })
  } catch (error) {
    console.error('Error updating board:', error)
    const message = error instanceof Error && error.message.includes('last board')
      ? error.message
      : 'Failed to update board'
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message.includes('last board') ? 400 : 500 }
    )
  }
}

// DELETE /api/boards/[boardId] - 删除看板
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params

  try {
    const success = await dbHelpers.deleteBoard(boardId)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting board:', error)
    const message = error instanceof Error && error.message.includes('last board')
      ? error.message
      : 'Failed to delete board'
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && error.message.includes('last board') ? 400 : 500 }
    )
  }
}
