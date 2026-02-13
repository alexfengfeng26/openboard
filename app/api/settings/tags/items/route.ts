/**
 * 全局标签管理 API 路由
 * GET - 获取所有全局标签
 * POST - 添加新标签
 * PUT - 更新所有标签（批量替换）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { Tag } from '@/types/card.types'

/**
 * 获取所有全局标签
 * GET /api/settings/tags/items
 */
export async function GET(): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const tags = await storage.getGlobalTags()
    
    return NextResponse.json({
      success: true,
      data: tags,
    })
  } catch (error) {
    console.error('[Tags Items API] GET 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取全局标签失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 添加新标签
 * POST /api/settings/tags/items
 * Body: { name: string, color: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { name, color } = body
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '标签名称不能为空',
        },
        { status: 400 }
      )
    }
    
    const storage = await getSettingsStorage()
    
    const newTag: Tag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      color: color || '#6b7280',
    }
    
    const settings = await storage.addGlobalTag(newTag)
    
    return NextResponse.json({
      success: true,
      data: settings.globalTags,
    })
  } catch (error) {
    console.error('[Tags Items API] POST 失败:', error)
    const message = error instanceof Error ? error.message : '添加标签失败'
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}

/**
 * 批量更新标签（替换所有）
 * PUT /api/settings/tags/items
 * Body: Tag[]
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    
    if (!Array.isArray(body)) {
      return NextResponse.json(
        {
          success: false,
          error: '参数必须是标签数组',
        },
        { status: 400 }
      )
    }
    
    const storage = await getSettingsStorage()
    const settings = await storage.updateGlobalTags(body)
    
    return NextResponse.json({
      success: true,
      data: settings.globalTags,
    })
  } catch (error) {
    console.error('[Tags Items API] PUT 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新标签失败',
      },
      { status: 500 }
    )
  }
}
