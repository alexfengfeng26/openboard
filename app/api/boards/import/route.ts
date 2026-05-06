import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'
import type { Board } from '@/types'

// POST /api/boards/import - 导入看板
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const boardData = body as Board

    if (!boardData || typeof boardData.title !== 'string' || boardData.title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid board data' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const newBoardId = `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // 生成新的列表和卡片 ID，避免覆盖现有数据
    const newLanes = (boardData.lanes || []).map((lane, laneIndex) => {
      const newLaneId = `lane-${Date.now()}-${laneIndex}-${Math.random().toString(36).slice(2, 6)}`
      const newCards = (lane.cards || []).map((card, cardIndex) => ({
        ...card,
        id: `card-${Date.now()}-${laneIndex}-${cardIndex}-${Math.random().toString(36).slice(2, 6)}`,
        laneId: newLaneId,
        createdAt: card.createdAt || now,
        updatedAt: card.updatedAt || now,
      }))

      return {
        ...lane,
        id: newLaneId,
        boardId: newBoardId,
        cards: newCards,
        createdAt: lane.createdAt || now,
        updatedAt: lane.updatedAt || now,
      }
    })

    const newBoard: Board = {
      id: newBoardId,
      title: boardData.title.trim(),
      createdAt: now,
      updatedAt: now,
      tags: boardData.tags || [],
      lanes: newLanes,
    }

    const result = await dbHelpers.createBoard(newBoard.title)
    // 由于 createBoard 会创建默认列表，我们需要用导入的数据替换
    const importedBoard = await dbHelpers.updateBoard(result.id, {
      lanes: newBoard.lanes,
    })

    if (!importedBoard) {
      return NextResponse.json(
        { success: false, error: 'Failed to create imported board' },
        { status: 500 }
      )
    }

    // 更新看板标题（createBoard 已经使用传入的 title，但以防万一）
    if (importedBoard.title !== newBoard.title) {
      await dbHelpers.updateBoard(importedBoard.id, { title: newBoard.title })
    }

    return NextResponse.json({ success: true, data: importedBoard }, { status: 201 })
  } catch (error) {
    console.error('Error importing board:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import board' },
      { status: 500 }
    )
  }
}
