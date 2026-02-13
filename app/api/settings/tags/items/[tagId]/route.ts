/**
 * 单个标签管理 API 路由
 * PATCH - 更新标签
 * DELETE - 删除标签
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { Tag } from '@/types/card.types'

interface RouteParams {
  params: Promise<{ tagId: string }>
}

/**
 * 更新标签
 * PATCH /api/settings/tags/items/:tagId
 * Body: { name?: string, color?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { tagId } = await params
    const body = await request.json()
    const { name, color } = body
    
    const storage = await getSettingsStorage()
    const currentSettings = await storage.getTagsSettings()
    
    // 查找并更新标签
    const updatedTags = currentSettings.globalTags.map((tag: Tag) => {
      if (tag.id === tagId) {
        return {
          ...tag,
          ...(name !== undefined && { name: name.trim() }),
          ...(color !== undefined && { color }),
        }
      }
      return tag
    })
    
    // 检查标签是否存在
    const hasTag = currentSettings.globalTags.some((t: Tag) => t.id === tagId)
    if (!hasTag) {
      return NextResponse.json(
        {
          success: false,
          error: '标签不存在',
        },
        { status: 404 }
      )
    }
    
    const settings = await storage.updateGlobalTags(updatedTags)
    
    return NextResponse.json({
      success: true,
      data: settings.globalTags,
    })
  } catch (error) {
    console.error('[Tag Item API] PATCH 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新标签失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 删除标签
 * DELETE /api/settings/tags/items/:tagId
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { tagId } = await params
    
    const storage = await getSettingsStorage()
    const settings = await storage.removeGlobalTag(tagId)
    
    return NextResponse.json({
      success: true,
      data: settings.globalTags,
    })
  } catch (error) {
    console.error('[Tag Item API] DELETE 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '删除标签失败',
      },
      { status: 500 }
    )
  }
}
