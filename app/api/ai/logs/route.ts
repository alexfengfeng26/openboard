import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'
import type { OperationLogEntry } from '@/types/ai-tools.types'

// GET /api/ai/logs?boardId=xxx - 获取看板操作日志
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const boardId = searchParams.get('boardId')

  if (!boardId) {
    return NextResponse.json(
      { success: false, error: 'boardId is required' },
      { status: 400 }
    )
  }

  try {
    const board = await dbHelpers.getBoard(boardId)

    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: board.operationLogs || [],
    })
  } catch (error) {
    console.error('Error fetching operation logs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch operation logs' },
      { status: 500 }
    )
  }
}

// POST /api/ai/logs?boardId=xxx - 添加操作日志
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const boardId = searchParams.get('boardId')

  if (!boardId) {
    return NextResponse.json(
      { success: false, error: 'boardId is required' },
      { status: 400 }
    )
  }

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
