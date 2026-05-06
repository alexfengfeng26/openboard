import { NextResponse } from 'next/server'
import { ChatHistoryStorage } from '@/lib/storage/ChatHistoryStorage'
import type { ChatMessage } from '@/types/ai-tools.types'

const storage = ChatHistoryStorage.getInstance()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('boardId')

    if (!boardId) {
      return NextResponse.json(
        { success: false, error: 'Missing boardId' },
        { status: 400 }
      )
    }

    const messages = await storage.getHistory(boardId)
    return NextResponse.json({ success: true, data: messages })
  } catch (error) {
    console.error('Error reading chat history:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to read chat history' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('boardId')

    if (!boardId) {
      return NextResponse.json(
        { success: false, error: 'Missing boardId' },
        { status: 400 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as { messages?: ChatMessage[] }
    const messages = Array.isArray(body.messages) ? body.messages : []

    await storage.saveHistory(boardId, messages)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving chat history:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save chat history' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('boardId')

    if (!boardId) {
      return NextResponse.json(
        { success: false, error: 'Missing boardId' },
        { status: 400 }
      )
    }

    await storage.clearHistory(boardId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chat history:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete chat history' },
      { status: 500 }
    )
  }
}
