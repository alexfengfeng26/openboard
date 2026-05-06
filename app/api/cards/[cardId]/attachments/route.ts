import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { dbHelpers } from '@/lib/db'

const ATTACHMENTS_DIR = path.join(process.cwd(), 'public', 'attachments')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_ATTACHMENTS_PER_CARD = 10

const ALLOWED_MIME_TYPES = [
  'image/',
  'application/pdf',
  'text/',
]

function getAttachmentDir(boardId: string, cardId: string): string {
  const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeCardId = cardId.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(ATTACHMENTS_DIR, safeBoardId, safeCardId)
}

function generateAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
}

function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.some((prefix) => mimeType.startsWith(prefix))
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params
    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('boardId')

    if (!boardId) {
      return NextResponse.json(
        { success: false, error: 'Missing boardId' },
        { status: 400 }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Expected multipart/form-data' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    const mimeType = file.type || 'application/octet-stream'
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json(
        { success: false, error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // 检查卡片附件数量限制
    const board = await dbHelpers.getBoard(boardId)
    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      )
    }

    let currentAttachmentCount = 0
    for (const lane of board.lanes) {
      for (const card of lane.cards) {
        if (card.id === cardId) {
          currentAttachmentCount = card.attachments?.length || 0
          break
        }
      }
    }

    if (currentAttachmentCount >= MAX_ATTACHMENTS_PER_CARD) {
      return NextResponse.json(
        { success: false, error: 'Maximum 10 attachments per card' },
        { status: 400 }
      )
    }

    const attachmentId = generateAttachmentId()
    const dir = getAttachmentDir(boardId, cardId)
    await ensureDir(dir)

    const ext = path.extname(file.name)
    const originalName = sanitizeFileName(file.name)
    const fileName = `${attachmentId}${ext}`
    const filePath = path.join(dir, fileName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    const attachment = {
      id: attachmentId,
      name: fileName,
      originalName,
      size: file.size,
      mimeType,
      url: `/attachments/${boardId.replace(/[^a-zA-Z0-9_-]/g, '')}/${cardId.replace(/[^a-zA-Z0-9_-]/g, '')}/${fileName}`,
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json({ success: true, data: attachment })
  } catch (error) {
    console.error('Error uploading attachment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload attachment' },
      { status: 500 }
    )
  }
}
