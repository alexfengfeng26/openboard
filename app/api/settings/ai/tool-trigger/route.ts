/**
 * AI 工具触发配置 API 路由
 * GET - 获取工具触发配置
 * PUT - 更新工具触发配置
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { AiToolTriggerConfig } from '@/types/settings.types'

/**
 * 获取工具触发配置
 * GET /api/settings/ai/tool-trigger
 */
export async function GET(): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const settings = await storage.getAiSettings()
    
    return NextResponse.json({
      success: true,
      data: settings.toolTrigger,
    })
  } catch (error) {
    console.error('[Tool Trigger API] GET 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取工具触发配置失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 更新工具触发配置
 * PUT /api/settings/ai/tool-trigger
 * Body: AiToolTriggerConfig
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const storage = await getSettingsStorage()
    
    const settings = await storage.updateToolTriggerConfig(body)
    
    return NextResponse.json({
      success: true,
      data: settings.toolTrigger,
    })
  } catch (error) {
    console.error('[Tool Trigger API] PUT 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新工具触发配置失败',
      },
      { status: 500 }
    )
  }
}
