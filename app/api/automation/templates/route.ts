/**
 * 预设规则模板 API
 */

import { NextResponse } from 'next/server'
import { getPresetTemplates } from '@/lib/automation/templates'

export async function GET() {
  try {
    const templates = getPresetTemplates()
    return NextResponse.json({ success: true, templates })
  } catch (error) {
    console.error('[Automation Templates] error:', error)
    return NextResponse.json(
      { success: false, error: '获取模板失败' },
      { status: 500 }
    )
  }
}
