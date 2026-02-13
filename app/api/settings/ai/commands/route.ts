/**
 * AI 命令设置 API 路由
 * GET - 获取 AI 命令列表
 * PUT - 更新 AI 命令列表
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { AiCommand } from '@/types/ai-commands.types'

/**
 * 获取 AI 命令列表
 * GET /api/settings/ai/commands
 */
export async function GET(): Promise<NextResponse> {
  try {
    const storage = await getSettingsStorage()
    const settings = await storage.getAiSettings()
    
    return NextResponse.json({
      success: true,
      data: settings.commands,
    })
  } catch (error) {
    console.error('[AI Commands API] GET 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取 AI 命令失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 更新 AI 命令列表
 * PUT /api/settings/ai/commands
 * Body: AiCommand[]
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    
    if (!Array.isArray(body.commands)) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：commands 必须是数组',
        },
        { status: 400 }
      )
    }
    
    const storage = await getSettingsStorage()
    const settings = await storage.updateAiCommands(body.commands)
    
    return NextResponse.json({
      success: true,
      data: settings.commands,
    })
  } catch (error) {
    console.error('[AI Commands API] PUT 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新 AI 命令失败',
      },
      { status: 500 }
    )
  }
}
