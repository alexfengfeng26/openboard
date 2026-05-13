/**
 * 克隆模板 API 路由
 * POST /api/templates/[id]/clone
 * Body: { name?, description?, tags?, scope?, boardId? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateManager } from '@/lib/template/TemplateManager'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params
    const body = await request.json()

    const overrides = body
      ? {
          name: body.name,
          description: body.description,
          tags: body.tags,
          scope: body.scope,
          boardId: body.boardId,
        }
      : undefined

    const manager = await getTemplateManager()
    const template = await manager.clone(id, overrides)

    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, template })
  } catch (error) {
    console.error('[Templates API] clone 失败:', error)
    return NextResponse.json(
      { success: false, error: '克隆模板失败' },
      { status: 500 }
    )
  }
}
