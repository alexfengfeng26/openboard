/**
 * 批量导出模板 API 路由
 * POST /api/templates/export
 * Body: { ids: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateManager } from '@/lib/template/TemplateManager'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '请指定要导出的模板 ID 列表' },
        { status: 400 }
      )
    }

    const manager = await getTemplateManager()
    const bundle = await manager.export(ids)

    return NextResponse.json({ success: true, bundle })
  } catch (error) {
    console.error('[Templates API] export 失败:', error)
    return NextResponse.json(
      { success: false, error: '导出模板失败' },
      { status: 500 }
    )
  }
}
