/**
 * 图标上传 API
 * POST /api/settings/icons/upload
 * 上传图标文件到 public/icon，并自动加入设置
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'

const ICON_DIR = path.join(process.cwd(), 'public', 'icon')
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_MIME_TYPES = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]
const ALLOWED_EXTS = /\.(svg|png|jpg|jpeg|webp|gif)$/i

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未找到上传文件' },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '不支持的文件格式，仅允许 SVG、PNG、JPG、WebP、GIF' },
        { status: 400 }
      )
    }

    // 验证文件扩展名
    const originalName = file.name
    if (!ALLOWED_EXTS.test(originalName)) {
      return NextResponse.json(
        { success: false, error: '不支持的文件扩展名' },
        { status: 400 }
      )
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: '文件大小超过 2MB 限制' },
        { status: 400 }
      )
    }

    // 确保目录存在
    await fs.mkdir(ICON_DIR, { recursive: true })

    // 生成文件名（避免冲突：添加时间戳前缀）
    const ext = path.extname(originalName)
    const baseName = path.basename(originalName, ext)
    const timestamp = Date.now()
    const safeName = `${baseName}-${timestamp}${ext}`
    const filePath = path.join(ICON_DIR, safeName)

    // 写入文件
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // 自动加入设置
    const storage = await getSettingsStorage()
    const existing = await storage.getIconSettings()
    const newIcon = {
      id: safeName,
      name: baseName,
      url: `/icon/${safeName}`,
    }

    await storage.updateIconSettings({
      icons: [...existing.icons, newIcon],
    })

    return NextResponse.json({
      success: true,
      data: newIcon,
    })
  } catch (error) {
    console.error('[Icons Upload API] POST 失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '上传图标失败',
      },
      { status: 500 }
    )
  }
}
