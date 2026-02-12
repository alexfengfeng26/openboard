import { NextResponse } from 'next/server'
import { resetStorage } from '@/lib/storage/StorageAdapter'

export async function POST() {
  // 仅在开发环境允许
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  // 重置存储（清除缓存并重新初始化）
  await resetStorage()

  return NextResponse.json({
    success: true,
    message: 'Storage reset successfully',
  })
}
