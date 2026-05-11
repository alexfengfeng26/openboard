import { NextResponse } from 'next/server'
import { ServerToolExecutor } from '@/lib/ai-tools/server-executor'
import { dbHelpers } from '@/lib/db'
import type { OperationLogEntry, ToolCallRequest } from '@/types/ai-tools.types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      boardId?: string
      logId?: string
      undoPayload?: ToolCallRequest
    }

    const boardId = typeof body.boardId === 'string' ? body.boardId : undefined
    let undoPayload = body.undoPayload

    if (!undoPayload && boardId && body.logId) {
      const logs = await dbHelpers.getOperationLogs(boardId)
      const source = logs.find((log) => log.id === body.logId)
      const deadline = source?.undoDeadline ? new Date(source.undoDeadline).getTime() : undefined
      if (deadline && Date.now() > deadline) {
        return NextResponse.json({ success: false, error: '撤销窗口已过期' }, { status: 409 })
      }
      undoPayload = source?.undoPayload
    }

    if (!undoPayload) {
      return NextResponse.json({ success: false, error: '缺少可用的撤销动作' }, { status: 400 })
    }

    const result = await ServerToolExecutor.execute(undoPayload)
    const undoLog: OperationLogEntry = {
      id: `undo-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: result.success ? 'executed' : 'failed',
      toolName: undoPayload.toolName,
      params: undoPayload.params,
      result: result.result,
      error: result.error,
      confirmedBy: 'user',
      userNote: 'undo',
    }

    const targetBoardId = boardId ?? (typeof undoPayload.params.boardId === 'string' ? undoPayload.params.boardId : undefined)
    if (targetBoardId) {
      await dbHelpers.addOperationLog(targetBoardId, undoLog)
    }

    return NextResponse.json({ success: result.success, data: result, error: result.error })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '撤销失败' },
      { status: 500 }
    )
  }
}

