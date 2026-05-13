/**
 * 导入模板 API 路由
 * POST /api/templates/import
 * Body: { bundle: ExportBundle }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateManager } from '@/lib/template/TemplateManager'
import type { ExportBundle } from '@/types/template.types'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const bundle: ExportBundle = body.bundle

    if (!bundle || !Array.isArray(bundle.templates)) {
      return NextResponse.json(
        { success: false, error: '无效的导入数据格式' },
        { status: 400 }
      )
    }

    const manager = await getTemplateManager()
    const result = await manager.import(bundle)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('[Templates API] import 失败:', error)
    return NextResponse.json(
      { success: false, error: '导入模板失败' },
      { status: 500 }
    )
  }
}
