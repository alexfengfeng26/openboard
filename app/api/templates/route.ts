/**
 * 模板 API 路由
 * GET - 获取模板列表（支持过滤）
 * POST - 创建新模板
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateManager } from '@/lib/template/TemplateManager'
import { initializeBuiltinTemplates } from '@/lib/template/init-templates'
import type { TemplateFilter, TemplateDraft } from '@/types/template.types'

/**
 * 获取模板列表
 * GET /api/templates?type=&scope=&boardId=&tag=&q=
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const filter: TemplateFilter = {}

    const type = searchParams.get('type')
    if (type) filter.type = type as TemplateFilter['type']

    const scope = searchParams.get('scope')
    if (scope) filter.scope = scope as TemplateFilter['scope']

    const boardId = searchParams.get('boardId')
    if (boardId) filter.boardId = boardId

    const tag = searchParams.get('tag')
    if (tag) filter.tag = tag

    const q = searchParams.get('q')
    if (q) filter.q = q

    await initializeBuiltinTemplates()
    const manager = await getTemplateManager()
    const templates = await manager.list(filter)

    return NextResponse.json({
      success: true,
      templates,
      total: templates.length,
    })
  } catch (error) {
    console.error('[Templates API] GET 失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模板列表失败' },
      { status: 500 }
    )
  }
}

/**
 * 创建新模板
 * POST /api/templates
 * Body: { meta: { type, name, description?, tags?, icon?, color?, scope, boardId?, builtin? }, content }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { meta, content } = body

    if (!meta || !meta.type || !meta.name) {
      return NextResponse.json(
        { success: false, error: '模板类型和名称不能为空' },
        { status: 400 }
      )
    }

    const draft: TemplateDraft = {
      meta: {
        type: meta.type,
        name: meta.name.trim(),
        description: meta.description?.trim(),
        tags: meta.tags,
        icon: meta.icon,
        color: meta.color,
        scope: meta.scope || 'global',
        boardId: meta.boardId,
        builtin: false,
      },
      content: content || {},
    }

    const manager = await getTemplateManager()
    const template = await manager.create(draft)

    return NextResponse.json(
      { success: true, template },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Templates API] POST 失败:', error)
    return NextResponse.json(
      { success: false, error: '创建模板失败' },
      { status: 500 }
    )
  }
}
