import { NextResponse } from 'next/server'
import { ServerToolExecutor } from '@/lib/ai-tools/server-executor'
import { dbHelpers } from '@/lib/db'
import type {
  AiExecutionPlan,
  AiExecutionPlanStep,
  OperationLogEntry,
  ToolCallRequest,
  ToolExecutionResult,
} from '@/types/ai-tools.types'

export const runtime = 'nodejs'

const DEFAULT_UNDO_WINDOW_SECONDS = 30

function getSafeParams(params: unknown): Record<string, unknown> {
  if (params && typeof params === 'object' && !Array.isArray(params)) {
    return params as Record<string, unknown>
  }
  return {}
}

async function prepareUndoPayload(step: AiExecutionPlanStep): Promise<ToolCallRequest | undefined> {
  const { toolCall } = step
  const { toolName } = toolCall
  const params = getSafeParams(toolCall.params)
  const boardId = typeof params.boardId === 'string' ? params.boardId : undefined
  if (!boardId) return undefined

  if (toolName === 'update_card') {
    const cardId = typeof params.cardId === 'string' ? params.cardId : undefined
    if (!cardId) return undefined
    const board = await dbHelpers.getBoard(boardId)
    const card = board?.lanes.flatMap((l) => l.cards).find((c) => c.id === cardId)
    if (!card) return undefined
    return {
      toolName: 'update_card',
      params: {
        boardId,
        cardId,
        title: card.title,
        description: card.description,
        tags: card.tags,
      },
    }
  }

  if (toolName === 'move_card') {
    const cardId = typeof params.cardId === 'string' ? params.cardId : undefined
    if (!cardId) return undefined
    const board = await dbHelpers.getBoard(boardId)
    const card = board?.lanes.flatMap((l) => l.cards).find((c) => c.id === cardId)
    if (!card) return undefined
    return {
      toolName: 'move_card',
      params: {
        boardId,
        cardId,
        toLaneId: card.laneId,
      },
    }
  }

  if (toolName === 'update_lane') {
    const laneId = typeof params.laneId === 'string' ? params.laneId : undefined
    if (!laneId) return undefined
    const board = await dbHelpers.getBoard(boardId)
    const lane = board?.lanes.find((l) => l.id === laneId)
    if (!lane) return undefined
    return {
      toolName: 'update_lane',
      params: {
        boardId,
        laneId,
        title: lane.title,
      },
    }
  }

  if (toolName === 'update_board') {
    const board = await dbHelpers.getBoard(boardId)
    if (!board) return undefined
    return {
      toolName: 'update_board',
      params: {
        boardId,
        title: board.title,
      },
    }
  }

  return undefined
}

function resolveUndoFromResult(
  step: AiExecutionPlanStep,
  result: ToolExecutionResult,
  fallbackUndo?: ToolCallRequest
): ToolCallRequest | undefined {
  if (!result.success) return undefined
  const params = getSafeParams(step.toolCall.params)
  const boardId = typeof params.boardId === 'string' ? params.boardId : undefined

  if (step.toolCall.toolName === 'create_card') {
    const createdId = (result.result as { id?: string } | undefined)?.id
    if (boardId && createdId) {
      return {
        toolName: 'delete_card',
        params: {
          boardId,
          cardId: createdId,
        },
      }
    }
  }

  if (step.toolCall.toolName === 'create_lane') {
    const createdId = (result.result as { id?: string } | undefined)?.id
    if (boardId && createdId) {
      return {
        toolName: 'delete_lane',
        params: {
          boardId,
          laneId: createdId,
        },
      }
    }
  }

  if (step.toolCall.toolName === 'create_board') {
    const createdId = (result.result as { id?: string } | undefined)?.id
    if (createdId) {
      return {
        toolName: 'delete_board',
        params: { boardId: createdId },
      }
    }
  }

  return fallbackUndo
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      plan?: AiExecutionPlan
      boardId?: string
      confirmedBy?: 'user' | 'auto'
      undoWindowSeconds?: number
    }
    const plan = body.plan
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      return NextResponse.json({ success: false, error: 'plan 无效' }, { status: 400 })
    }

    const confirmedBy = body.confirmedBy ?? 'user'
    const bodyBoardId = typeof body.boardId === 'string' && body.boardId.trim().length > 0
      ? body.boardId.trim()
      : undefined
    const inferredBoardId = bodyBoardId
      ?? plan.steps
        .map((step) => {
          const params = getSafeParams(step?.toolCall?.params)
          return typeof params.boardId === 'string' ? params.boardId : undefined
        })
        .find((id): id is string => typeof id === 'string' && id.trim().length > 0)

    const undoWindowSeconds = Math.max(5, Math.min(300, body.undoWindowSeconds ?? DEFAULT_UNDO_WINDOW_SECONDS))
    const now = Date.now()
    const undoDeadline = new Date(now + undoWindowSeconds * 1000).toISOString()

    const results: ToolExecutionResult[] = []
    const logs: OperationLogEntry[] = []
    const warnings: string[] = []

    for (const step of plan.steps) {
      if (!step || !step.toolCall || typeof step.toolCall.toolName !== 'string') {
        const invalidResult: ToolExecutionResult = {
          success: false,
          toolName: 'unknown',
          params: {},
          error: '无效的步骤数据',
          timestamp: new Date().toISOString(),
        }
        results.push(invalidResult)
        logs.push({
          id: `log-${typeof step?.stepId === 'string' ? step.stepId : `invalid-${Date.now()}`}`,
          timestamp: new Date().toISOString(),
          status: 'failed',
          toolName: 'unknown',
          params: {},
          error: invalidResult.error,
          confirmedBy,
          planId: plan.planId,
          stepId: typeof step?.stepId === 'string' ? step.stepId : undefined,
          riskLevel: step?.riskLevel,
        })
        continue
      }

      const normalizedStep: AiExecutionPlanStep = {
        ...step,
        toolCall: {
          ...step.toolCall,
          params: (() => {
            const params = getSafeParams(step.toolCall.params)
            if (!inferredBoardId) return params
            if (typeof params.boardId === 'string' && params.boardId.trim().length > 0) return params
            return { ...params, boardId: inferredBoardId }
          })(),
        },
      }
      const t0 = Date.now()
      let preUndo: ToolCallRequest | undefined
      try {
        preUndo = await prepareUndoPayload(normalizedStep)
      } catch (error) {
        warnings.push(
          `[${normalizedStep.stepId}] 预生成撤销信息失败: ${error instanceof Error ? error.message : 'unknown error'}`
        )
      }
      const result = await ServerToolExecutor.execute(normalizedStep.toolCall)
      const latencyMs = Date.now() - t0
      const undoPayload = resolveUndoFromResult(normalizedStep, result, preUndo)
      results.push(result)

      const log: OperationLogEntry = {
        id: `log-${normalizedStep.stepId}`,
        timestamp: new Date().toISOString(),
        status: result.success ? 'executed' : 'failed',
        toolName: normalizedStep.toolCall.toolName,
        params: normalizedStep.toolCall.params,
        result: result.result,
        error: result.error,
        confirmedBy,
        durationMs: latencyMs,
        latencyMs,
        planId: plan.planId,
        stepId: normalizedStep.stepId,
        riskLevel: normalizedStep.riskLevel,
        undoable: !!undoPayload,
        undoPayload,
        undoDeadline: undoPayload ? undoDeadline : undefined,
        idempotencyKey: normalizedStep.toolCall.idempotencyKey,
      }
      logs.push(log)

      const params = getSafeParams(normalizedStep.toolCall.params)
      const boardId = typeof params.boardId === 'string' ? params.boardId : undefined
      if (boardId) {
        try {
          await dbHelpers.addOperationLog(boardId, log)
        } catch (error) {
          warnings.push(
            `[${normalizedStep.stepId}] 写入操作日志失败: ${error instanceof Error ? error.message : 'unknown error'}`
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        planId: plan.planId,
        results,
        logs,
        warnings,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '执行计划失败' },
      { status: 500 }
    )
  }
}
