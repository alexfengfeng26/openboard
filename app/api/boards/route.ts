import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'
import type { Lane, Tag } from '@/lib/db'
import type { BoardTemplateContent } from '@/types/template.types'

// GET /api/boards?includeArchived=true - 获取所有看板列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const boards = await dbHelpers.getBoards(includeArchived)
    return NextResponse.json({ success: true, data: boards })
  } catch (error) {
    console.error('Error fetching boards:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch boards' },
      { status: 500 }
    )
  }
}

// POST /api/boards - 创建新看板
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, lanes, templateId } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    let templateLanes: (Pick<Lane, 'title'> & BoardTemplateContent['lanes'][number])[] | undefined
    let templateTags: Tag[] | undefined

    // 如果指定了模板 ID，优先从新系统获取
    if (templateId) {
      try {
        const { initializeBuiltinTemplates } = await import('@/lib/template/init-templates')
        const { getTemplateManager } = await import('@/lib/template/TemplateManager')
        await initializeBuiltinTemplates()
        const manager = await getTemplateManager()
        const result = await manager.apply(templateId, {})

        if (result?.content && typeof result.content === 'object' && 'lanes' in result.content) {
          const boardContent = result.content as BoardTemplateContent
          templateLanes = boardContent.lanes.map((l) => ({ title: l.title, cards: l.cards }))
          templateTags = boardContent.tags
        }
      } catch (templateError) {
        console.warn('从模板系统获取看板模板失败，回退到默认:', templateError)
      }
    }

    // 如果没有从模板获取到 lanes，使用请求中的 lanes
    if (!templateLanes) {
      templateLanes = Array.isArray(lanes)
        ? lanes.map((l: Pick<Lane, 'title'>) => ({ title: l.title }))
        : undefined
    }

    const board = await dbHelpers.createBoard(title.trim(), templateLanes, undefined, templateTags)
    return NextResponse.json({ success: true, data: board }, { status: 201 })
  } catch (error) {
    console.error('Error creating board:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create board' },
      { status: 500 }
    )
  }
}
