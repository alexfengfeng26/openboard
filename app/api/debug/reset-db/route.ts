import { NextResponse } from 'next/server'
import { resetDb, getDb } from '@/lib/db'

export async function POST() {
  // 仅在开发环境允许
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  // 重置数据库实例
  await resetDb()

  // 重新获取数据库（会触发重新初始化）
  const db = await getDb()

  return NextResponse.json({
    success: true,
    message: 'Database reset successfully',
    lanes: db.data.boards[0].lanes.length,
    cards: db.data.boards[0].lanes.reduce((acc, lane) => acc + lane.cards.length, 0)
  })
}
