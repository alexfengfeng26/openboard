import { NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'

/**
 * 获取全局标签
 * GET /api/tags
 */
export async function GET() {
  try {
    const storage = await getSettingsStorage()
    const tags = await storage.getGlobalTags()

    return NextResponse.json({ success: true, data: tags })
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json(
      { success: false, error: '获取标签失败' },
      { status: 500 }
    )
  }
}
