import { NextResponse } from 'next/server'
import { suggestTagsForContent, TagSuggestionError, type TagSuggestionItem } from '@/lib/ai/tag-suggestions'

export const runtime = 'nodejs'

interface RequestBody {
  title?: string
  description?: string
  availableTags?: TagSuggestionItem[]
  maxTags?: number
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as RequestBody | null
    const selected = await suggestTagsForContent({
      title: body?.title || '',
      description: body?.description || '',
      availableTags: Array.isArray(body?.availableTags) ? body.availableTags : [],
      maxTags: body?.maxTags,
      aiOnly: true,
      requireApiKey: true,
    })

    return NextResponse.json({ success: true, data: selected })
  } catch (error) {
    if (error instanceof TagSuggestionError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'AI 标签服务异常' },
      { status: 500 }
    )
  }
}
