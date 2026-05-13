/**
 * 预设规则模板 API
 * 内部转发到新模板系统
 */

import { NextResponse } from 'next/server'
import { getPresetTemplates } from '@/lib/automation/templates'
import { getTemplateManager } from '@/lib/template/TemplateManager'
import { initializeBuiltinTemplates } from '@/lib/template/init-templates'

export async function GET() {
  try {
    // 优先从新模板系统获取
    await initializeBuiltinTemplates()
    const manager = await getTemplateManager()
    const templates = await manager.list({ type: 'automation' })

    // 如果新系统没有数据，回退到旧系统
    if (templates.length === 0) {
      const legacyTemplates = getPresetTemplates()
      return NextResponse.json({ success: true, templates: legacyTemplates })
    }

    return NextResponse.json({ success: true, templates })
  } catch (error) {
    console.error('[Automation Templates] error:', error)
    // 出错时回退到旧系统
    try {
      const legacyTemplates = getPresetTemplates()
      return NextResponse.json({ success: true, templates: legacyTemplates })
    } catch {
      return NextResponse.json(
        { success: false, error: '获取模板失败' },
        { status: 500 }
      )
    }
  }
}
