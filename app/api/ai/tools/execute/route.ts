import { NextResponse } from 'next/server'
import { ServerToolExecutor } from '@/lib/ai-tools/server-executor'
import type { ToolCallRequest, ToolExecutionResult } from '@/types/ai-tools.types'

export const runtime = 'nodejs'

/**
 * POST /api/ai/tools/execute - 执行工具调用
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { toolCalls?: ToolCallRequest[]; tool_calls?: ToolCallRequest[] }
    const toolCalls = body.toolCalls ?? body.tool_calls

    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return NextResponse.json(
        { error: 'Invalid toolCalls/tool_calls format' },
        { status: 400 }
      )
    }

    const results: ToolExecutionResult[] = []

    for (const call of toolCalls) {
      const result = await ServerToolExecutor.execute(call)
      results.push(result)
    }

    return NextResponse.json({
      success: true,
      data: results
    })
  } catch (error) {
    console.error('[AI Tools] Execute error:', error)
    return NextResponse.json(
      { error: 'Failed to execute tools' },
      { status: 500 }
    )
  }
}
