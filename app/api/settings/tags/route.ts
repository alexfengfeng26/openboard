/**
 * 标签设置 API 路由
 * GET - 获取标签设置
 * PUT - 更新标签设置
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { TagsSettings } from '@/types/settings.types'

/**
 * 获取标签设置
 * GET /api/settings/tags
 */
export async function GET(): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const settings = await storage.getTagsSettings()
    
    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('[Tags Settings API] GET 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取标签设置失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 更新标签设置
 * PUT /api/settings/tags
 * Body: Partial<TagsSettings>
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const storage = await getSettingsStorage()
    
    const settings = await storage.updateTagsSettings(body)
    
    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('[Tags Settings API] PUT 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新标签设置失败',
      },
      { status: 500 }
    )
  }
}
