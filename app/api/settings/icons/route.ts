/**
 * 图标设置 API
 * GET - 获取图标列表
 * PUT - 更新图标列表
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { IconSettings } from '@/types/settings.types'

/**
 * 获取图标设置
 * GET /api/settings/icons
 */
export async function GET(): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const icons = await storage.getIconSettings()

    return NextResponse.json({
      success: true,
      data: icons,
    })
  } catch (error) {
    console.error('[Icons API] GET 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取图标设置失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 更新图标设置
 * PUT /api/settings/icons
 * Body: { icons?: BoardIcon[], userAvatar?: string | null, aiAvatar?: string | null }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const storage = await getSettingsStorage()

    const updates: Partial<IconSettings> = {}
    if (Array.isArray(body.icons)) {
      updates.icons = body.icons
    }
    if (Object.prototype.hasOwnProperty.call(body, 'userAvatar')) {
      if (typeof body.userAvatar !== 'string' && body.userAvatar !== null) {
        return NextResponse.json(
          { success: false, error: '无效的用户头像地址' },
          { status: 400 }
        )
      }
      updates.userAvatar = body.userAvatar ?? undefined
    }
    if (Object.prototype.hasOwnProperty.call(body, 'aiAvatar')) {
      if (typeof body.aiAvatar !== 'string' && body.aiAvatar !== null) {
        return NextResponse.json(
          { success: false, error: '无效的 AI 头像地址' },
          { status: 400 }
        )
      }
      updates.aiAvatar = body.aiAvatar ?? undefined
    }

    const result = await storage.updateIconSettings(updates)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[Icons API] PUT 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新图标设置失败',
      },
      { status: 500 }
    )
  }
}
