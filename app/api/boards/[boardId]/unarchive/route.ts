import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'

// PATCH /api/boards/[boardId]/unarchive - 恢复看板
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params

  try {
    const board = await dbHelpers.unarchiveBoard(boardId)

    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: board })
  } catch (error) {
    console.error('Error unarchiving board:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to unarchive board' },
      { status: 500 }
    )
  }
}
