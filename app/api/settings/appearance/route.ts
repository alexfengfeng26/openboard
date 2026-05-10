/**
 * 外观设置 API 路由
 * GET - 获取外观设置
 * PUT - 更新外观设置
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'

/**
 * 获取外观设置
 * GET /api/settings/appearance
 */
export async function GET(): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const settings = await storage.getAppearanceSettings()

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('[Appearance API] GET 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取外观设置失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 更新外观设置
 * PUT /api/settings/appearance
 * Body: { theme?: 'claude' | 'notion' }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const storage = await getSettingsStorage()

    const result = await storage.updateAppearanceSettings(body)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[Appearance API] PUT 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新外观设置失败',
      },
      { status: 500 }
    )
  }
}
