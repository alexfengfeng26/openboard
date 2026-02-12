import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'

// GET /api/boards - 获取所有看板列表
export async function GET() {
  try {
    const boards = await dbHelpers.getBoards()
    return NextResponse.json({ success: true, data: boards })
  } catch (error) {
    console.error('Error fetching boards:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch boards' },
      { status: 500 }
    )
  }
}

// POST /api/boards - 创建新看板
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    const board = await dbHelpers.createBoard(title.trim())
    return NextResponse.json({ success: true, data: board }, { status: 201 })
  } catch (error) {
    console.error('Error creating board:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create board' },
      { status: 500 }
    )
  }
}
