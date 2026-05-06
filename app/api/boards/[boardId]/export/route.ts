import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'
import { MarkdownBoard } from '@/lib/storage/MarkdownBoard'

// GET /api/boards/[boardId]/export?format=json|csv|md - 导出看板
export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'

  try {
    const board = await dbHelpers.getBoard(boardId)

    if (!board) {
      return NextResponse.json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      )
    }

    if (format === 'json') {
      return NextResponse.json(
        { success: true, data: board },
        {
          headers: {
            'Content-Disposition': `attachment; filename="${encodeURIComponent(board.title)}.json"`,
          },
        }
      )
    }

    if (format === 'csv') {
      const rows: string[] = []
      rows.push('标题,描述,列表,标签,创建时间')

      for (const lane of board.lanes) {
        for (const card of lane.cards) {
          const title = `"${card.title.replace(/"/g, '""')}"`
          const description = card.description ? `"${card.description.replace(/"/g, '""')}"` : '""'
          const tags = card.tags?.map((t) => t.name).join('、') || ''
          rows.push(`${title},${description},${lane.title},${tags},${card.createdAt}`)
        }
      }

      const csvContent = rows.join('\n')
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(board.title)}.csv"`,
        },
      })
    }

    if (format === 'md') {
      const mdContent = MarkdownBoard.generateMarkdownBody(board)
      return new NextResponse(mdContent, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(board.title)}.md"`,
        },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid format. Supported: json, csv, md' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error exporting board:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export board' },
      { status: 500 }
    )
  }
}
