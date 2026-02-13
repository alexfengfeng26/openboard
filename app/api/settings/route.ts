/**
 * 设置 API 路由
 * GET - 获取设置
 * PUT - 更新设置
 * DELETE - 重置为默认设置
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { AppSettings, AiSettings, BoardViewSettings } from '@/types/settings.types'

/**
 * 获取设置
 * GET /api/settings
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const settings = await storage.getSettings()
    
    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('[Settings API] GET 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取设置失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 更新设置
 * PUT /api/settings
 * Body: { ai?: Partial<AiSettings>, boardView?: Partial<BoardViewSettings> }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const storage = await getSettingsStorage()
    
    let result: AppSettings
    
    // 根据传入的参数决定更新哪些部分
    if (body.ai) {
      await storage.updateAiSettings(body.ai)
    }
    
    if (body.boardView) {
      await storage.updateBoardViewSettings(body.boardView)
    }
    
    // 获取更新后的完整设置
    result = await storage.getSettings()
    
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[Settings API] PUT 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新设置失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 重置为默认设置
 * DELETE /api/settings
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const settings = await storage.resetToDefaults()
    
    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('[Settings API] DELETE 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '重置设置失败',
      },
      { status: 500 }
    )
  }
}
