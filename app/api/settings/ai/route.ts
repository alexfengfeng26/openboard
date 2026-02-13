/**
 * AI 设置 API 路由
 * GET - 获取 AI 设置
 * PUT - 更新 AI 设置
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { AiSettings } from '@/types/settings.types'

/**
 * 获取 AI 设置
 * GET /api/settings/ai
 */
export async function GET(): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const settings = await storage.getAiSettings()
    
    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('[AI Settings API] GET 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取 AI 设置失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 更新 AI 设置
 * PUT /api/settings/ai
 * Body: Partial<AiSettings>
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const storage = await getSettingsStorage()
    
    const settings = await storage.updateAiSettings(body)
    
    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('[AI Settings API] PUT 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新 AI 设置失败',
      },
      { status: 500 }
    )
  }
}
