import { NextResponse } from 'next/server'
import { buildExecutionPlan } from '@/lib/ai/plan'
import type { AiExecutionMode, ToolCallRequest } from '@/types/ai-tools.types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      toolCalls?: ToolCallRequest[]
      mode?: AiExecutionMode
    }
    const toolCalls = Array.isArray(body.toolCalls) ? body.toolCalls : []
    if (toolCalls.length === 0) {
      return NextResponse.json({ success: false, error: 'toolCalls 不能为空' }, { status: 400 })
    }

    const mode = body.mode ?? 'balanced'
    const plan = buildExecutionPlan(toolCalls, mode)
    return NextResponse.json({ success: true, data: plan })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '生成执行计划失败',
      },
      { status: 500 }
    )
  }
}
