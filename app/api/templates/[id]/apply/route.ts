/**
 * 应用模板 API 路由
 * POST /api/templates/[id]/apply
 * Body: { context?: { board?, lane?, card?, user?, date? } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateManager } from '@/lib/template/TemplateManager'
import type { TemplateVariableContext } from '@/types/template.types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params
    const body = await request.json()
    const context: TemplateVariableContext = body.context || {}

    const manager = await getTemplateManager()
    const result = await manager.apply(id, context)

    if (!result) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, resolved: result })
  } catch (error) {
    console.error('[Templates API] apply 失败:', error)
    return NextResponse.json(
      { success: false, error: '应用模板失败' },
      { status: 500 }
    )
  }
}
