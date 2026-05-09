/**
 * 单条规则操作 API
 * PUT: 更新规则
 * DELETE: 删除规则
 * PATCH: 切换启用状态
 */

import { NextResponse } from 'next/server'
import { getRuleStorage } from '@/lib/automation/RuleStorage'

interface RouteParams {
  params: Promise<{ ruleId: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { ruleId } = await params
    const body = await request.json()

    const storage = await getRuleStorage()
    const rule = await storage.updateRule(ruleId, body)

    if (!rule) {
      return NextResponse.json(
        { success: false, error: '规则不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, rule })
  } catch (error) {
    console.error('[Automation Rule] PUT error:', error)
    return NextResponse.json(
      { success: false, error: '更新规则失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { ruleId } = await params

    const storage = await getRuleStorage()
    const deleted = await storage.deleteRule(ruleId)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '规则不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Automation Rule] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: '删除规则失败' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { ruleId } = await params

    const storage = await getRuleStorage()
    const rule = await storage.toggleRule(ruleId)

    if (!rule) {
      return NextResponse.json(
        { success: false, error: '规则不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, rule })
  } catch (error) {
    console.error('[Automation Rule] PATCH error:', error)
    return NextResponse.json(
      { success: false, error: '切换规则状态失败' },
      { status: 500 }
    )
  }
}
