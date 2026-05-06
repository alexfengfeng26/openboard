import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const ATTACHMENTS_DIR = path.join(process.cwd(), 'public', 'attachments')

function getAttachmentDir(boardId: string, cardId: string): string {
  const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeCardId = cardId.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(ATTACHMENTS_DIR, safeBoardId, safeCardId)
}

// DELETE /api/cards/[cardId]/attachments/[attachmentId] - 删除附件
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ cardId: string; attachmentId: string }> }
) {
  const { cardId, attachmentId } = await params
  const { searchParams } = new URL(request.url)
  const boardId = searchParams.get('boardId')

  if (!boardId) {
    return NextResponse.json(
      { success: false, error: 'Missing boardId' },
      { status: 400 }
    )
  }

  try {
    const dir = getAttachmentDir(boardId, cardId)
    const files = await fs.readdir(dir).catch(() => [] as string[])
    const targetFile = files.find((f) => f.startsWith(attachmentId))

    if (targetFile) {
      await fs.unlink(path.join(dir, targetFile))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete attachment' },
      { status: 500 }
    )
  }
}
