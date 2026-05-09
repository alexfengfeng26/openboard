/**
 * 扫描图标目录 API
 * GET /api/settings/icons/scan
 * 扫描 public/icon 目录，返回未被收录的图标文件
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { BoardIcon } from '@/types/settings.types'

const ICON_DIR = path.join(process.cwd(), 'public', 'icon')
const ALLOWED_EXTS = /\.(svg|png|jpg|jpeg|webp|gif)$/i

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 读取现有图标列表
    const storage = await getSettingsStorage()
    const existing = await storage.getIconSettings()
    const existingUrls = new Set(existing.icons.map((i) => i.url))
    const existingIds = new Set(existing.icons.map((i) => i.id))

    // 扫描目录
    let files: string[] = []
    try {
      files = await fs.readdir(ICON_DIR)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        // 目录不存在，返回空
        return NextResponse.json({
          success: true,
          data: { newIcons: [] },
        })
      }
      throw err
    }

    const newIcons: BoardIcon[] = files
      .filter((f) => ALLOWED_EXTS.test(f))
      .map((f) => {
        const name = f.replace(/\.[^.]+$/, '')
        const url = `/icon/${f}`
        return {
          id: f,
          name,
          url,
        }
      })
      .filter((icon) => !existingUrls.has(icon.url) && !existingIds.has(icon.id))

    return NextResponse.json({
      success: true,
      data: { newIcons },
    })
  } catch (error) {
    console.error('[Icons Scan API] GET 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '扫描图标目录失败',
      },
      { status: 500 }
    )
  }
}
