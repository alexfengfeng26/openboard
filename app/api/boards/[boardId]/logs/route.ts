import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'
import type { OperationLogEntry } from '@/types/ai-tools.types'

// GET /api/boards/[boardId]/logs - 获取操作日志
export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params

  try {
    const logs = await dbHelpers.getOperationLogs(boardId)
    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    console.error('Error fetching operation logs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch operation logs' },
      { status: 500 }
    )
  }
}

// POST /api/boards/[boardId]/logs - 添加操作日志
export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params

  try {
    const log = (await request.json()) as OperationLogEntry

    if (!log.id || !log.timestamp || !log.toolName) {
      return NextResponse.json(
        { success: false, error: 'Invalid log entry' },
        { status: 400 }
      )
    }

    await dbHelpers.addOperationLog(boardId, log)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding operation log:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add operation log' },
      { status: 500 }
    )
  }
}

// DELETE /api/boards/[boardId]/logs - 清空操作日志
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params

  try {
    const board = await dbHelpers.clearOperationLogs(boardId)

    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing operation logs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear operation logs' },
      { status: 500 }
    )
  }
}
