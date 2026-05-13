/**
 * 模板单资源 API 路由
 * GET - 获取单个模板
 * PUT - 更新模板（内置模板拒绝）
 * DELETE - 删除模板（内置模板拒绝）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateManager } from '@/lib/template/TemplateManager'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 获取单个模板
 * GET /api/templates/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params
    const manager = await getTemplateManager()
    const template = await manager.get(id)

    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, template })
  } catch (error) {
    console.error('[Templates API] GET 单资源失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模板失败' },
      { status: 500 }
    )
  }
}

/**
 * 更新模板
 * PUT /api/templates/[id]
 * Body: { meta?: { name?, description?, tags?, icon?, color?, scope?, boardId? }, content? }
 */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params
    const body = await request.json()

    const manager = await getTemplateManager()
    const template = await manager.update(id, body)

    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, template })
  } catch (error) {
    console.error('[Templates API] PUT 失败:', error)
    const message = error instanceof Error ? error.message : '更新模板失败'
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && message.includes('内置模板') ? 403 : 500 }
    )
  }
}

/**
 * 删除模板
 * DELETE /api/templates/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params
    const manager = await getTemplateManager()
    const deleted = await manager.delete(id)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Templates API] DELETE 失败:', error)
    const message = error instanceof Error ? error.message : '删除模板失败'
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && message.includes('内置模板') ? 403 : 500 }
    )
  }
}
