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
function migrateModelName(model: string): 'deepseek-v4-flash' | 'deepseek-v4-pro' {
  const legacyMap: Record<string, 'deepseek-v4-flash' | 'deepseek-v4-pro'> = {
    'deepseek-chat': 'deepseek-v4-flash',
    'deepseek-reasoner': 'deepseek-v4-pro',
  }
  return legacyMap[model] || (model as 'deepseek-v4-flash' | 'deepseek-v4-pro')
}

export async function GET(): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const settings = await storage.getAiSettings()
    
    // 兼容性处理：旧模型名映射到新模型名
    if (settings.defaultModel) {
      settings.defaultModel = migrateModelName(settings.defaultModel)
    }
    
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
