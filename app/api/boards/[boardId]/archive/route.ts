import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'

// PATCH /api/boards/[boardId]/archive - 归档/恢复看板
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params

  try {
    const body = await request.json()
    const { archived } = body

    if (typeof archived !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Invalid archived field' },
        { status: 400 }
      )
    }

    const board = await dbHelpers.updateBoard(boardId, {
      archivedAt: archived ? new Date().toISOString() : null,
    })

    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: board })
  } catch (error) {
    console.error('Error archiving board:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to archive board' },
      { status: 500 }
    )
  }
}
