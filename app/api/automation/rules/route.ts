/**
 * 自动化规则 CRUD API
 * GET: 获取所有规则
 * POST: 创建新规则
 */

import { NextResponse } from 'next/server'
import { getRuleStorage } from '@/lib/automation/RuleStorage'
import { RuleEngine } from '@/lib/automation/RuleEngine'
import type { AutomationRule } from '@/types/automation.types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('boardId') || undefined

    const storage = await getRuleStorage()
    const rules = await storage.getAllRules(boardId)

    return NextResponse.json({ success: true, rules })
  } catch (error) {
    console.error('[Automation Rules] GET error:', error)
    return NextResponse.json(
      { success: false, error: '获取规则失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, enabled, trigger, actions, boardId } = body

    if (!name || !trigger || !actions) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段' },
        { status: 400 }
      )
    }

    const storage = await getRuleStorage()
    const rule = await storage.createRule({
      name,
      description: description || '',
      enabled: enabled !== false,
      trigger,
      actions,
      boardId,
    })

    return NextResponse.json({ success: true, rule })
  } catch (error) {
    console.error('[Automation Rules] POST error:', error)
    return NextResponse.json(
      { success: false, error: '创建规则失败' },
      { status: 500 }
    )
  }
}
