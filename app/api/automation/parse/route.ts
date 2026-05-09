/**
 * AI 规则解析 API
 * 将自然语言描述转换为结构化规则
 */

import { NextResponse } from 'next/server'
import { parseRuleWithAI } from '@/lib/automation/ai-parser'
import type { ParseRuleRequest } from '@/types/automation.types'

export async function POST(request: Request) {
  try {
    const body: ParseRuleRequest = await request.json()
    const { description, boardId } = body

    if (!description || !description.trim()) {
      return NextResponse.json(
        { success: false, error: '规则描述不能为空' },
        { status: 400 }
      )
    }

    const result = await parseRuleWithAI(description, boardId)

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      rule: result.rule,
      matchedTemplate: result.matchedTemplate,
      explanation: result.explanation,
    })
  } catch (error) {
    console.error('[Automation Parse] error:', error)
    return NextResponse.json(
      { success: false, error: '解析规则失败' },
      { status: 500 }
    )
  }
}
