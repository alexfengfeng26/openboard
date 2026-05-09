/**
 * 图标删除 API
 * DELETE /api/settings/icons/[iconId]
 * 删除图标文件并从设置中移除
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'

const ICON_DIR = path.join(process.cwd(), 'public', 'icon')

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ iconId: string }> }
): Promise<NextResponse> {
  try {
    const { iconId } = await params

    if (!iconId) {
      return NextResponse.json(
        { success: false, error: '缺少图标 ID' },
        { status: 400 }
      )
    }

    // 安全校验：防止目录遍历
    const decodedId = decodeURIComponent(iconId)
    if (decodedId.includes('..') || decodedId.includes('/') || decodedId.includes('\\')) {
      return NextResponse.json(
        { success: false, error: '非法的图标 ID' },
        { status: 400 }
      )
    }

    const filePath = path.join(ICON_DIR, decodedId)

    // 从设置中移除
    const storage = await getSettingsStorage()
    const existing = await storage.getIconSettings()
    const icon = existing.icons.find((i) => i.id === decodedId)

    if (!icon) {
      return NextResponse.json(
        { success: false, error: '图标不存在' },
        { status: 404 }
      )
    }

    const newIcons = existing.icons.filter((i) => i.id !== decodedId)
    await storage.updateIconSettings({ icons: newIcons })

    // 尝试删除物理文件（失败不阻塞）
    try {
      await fs.unlink(filePath)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        console.warn(`[Icons Delete API] 删除文件失败: ${filePath}`, err)
      }
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('[Icons Delete API] DELETE 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '删除图标失败',
      },
      { status: 500 }
    )
  }
}
