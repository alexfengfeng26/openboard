import { NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'

export const runtime = 'nodejs'

interface SearchRequestBody {
  boardId: string
  boardTitle: string
  query: string
  lanes: Array<{
    id: string
    title: string
    cards: Array<{
      id: string
      title: string
      description?: string
      position: number
      createdAt: string
      updatedAt: string
      tags?: Array<{ id: string; name: string; color: string }>
    }>
  }>
  tags?: Array<{ id: string; name: string; color: string }>
}

interface SearchResponse {
  success: boolean
  cardIds?: string[]
  explanation?: string
  error?: string
}

function isValidDeepSeekApiKey(apiKey: string): boolean {
  return /^sk-[A-Za-z0-9_-]{16,}$/.test(apiKey.trim())
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      if ((response.status === 502 || response.status === 503 || response.status === 429) && i < maxRetries) {
        const delay = 1000 * Math.pow(2, i)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (i < maxRetries) {
        const delay = 1000 * Math.pow(2, i)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError || new Error('请求失败')
}

/**
 * 构建语义搜索的系统提示词
 */
function buildSearchSystemPrompt(): string {
  return `你是一个智能看板搜索助手。用户会用自然语言描述他们想找的卡片，你需要理解语义并返回匹配的卡片ID列表。

## 判断规则
- 仔细阅读用户的查询意图，不要只做字面匹配
- 考虑时间描述（如"上周"、"最近"、"超过7天"）
- 考虑状态描述（如"已完成"、"待处理"、"停滞"）
- 考虑标签/分类描述（如"高优先级"、"bug"、"功能需求"）
- 考虑位置描述（如"在待办列表中"、"进行中"）

## 输出格式
必须按以下 JSON 格式返回结果，不要包含任何其他文字：

\`\`\`json
{
  "cardIds": ["card-id-1", "card-id-2"],
  "explanation": "简要说明为什么这些卡片匹配"
}
\`\`\`

## 重要规则
1. 只输出 JSON，不要添加其他文字说明
2. 如果没有匹配的卡片，返回空的 cardIds 数组
3. explanation 用一句话简要说明匹配原因
4. 严格只返回确定匹配的卡片ID，不要猜测`.trim()
}

/**
 * 构建用户提示词
 */
function buildSearchUserPrompt(body: SearchRequestBody): string {
  const { boardTitle, query, lanes, tags } = body
  const now = new Date().toISOString()

  let prompt = `请根据用户的搜索查询，在看板中找到匹配的卡片。

当前时间: ${now}
看板名称: ${boardTitle}
用户查询: "${query}"

## 列表与卡片数据\n`

  for (const lane of lanes) {
    prompt += `\n### ${lane.title} (ID: ${lane.id})\n`
    for (const card of lane.cards) {
      prompt += `- [${card.id}] ${card.title}`
      if (card.description) {
        const shortDesc = card.description.length > 120 ? card.description.slice(0, 120) + '...' : card.description
        prompt += ` | 描述: ${shortDesc}`
      }
      if (card.tags && card.tags.length > 0) {
        prompt += ` | 标签: ${card.tags.map((t) => t.name).join(', ')}`
      }
      prompt += ` | 创建: ${card.createdAt} | 更新: ${card.updatedAt}\n`
    }
  }

  if (tags && tags.length > 0) {
    prompt += `\n## 可用标签\n${tags.map((t) => `- ${t.name}`).join('\n')}\n`
  }

  prompt += `\n请返回所有匹配用户查询 "${query}" 的卡片ID。`
  return prompt
}

/**
 * 解析 AI 返回的搜索结果
 */
function parseSearchResponse(content: string): { cardIds: string[]; explanation: string } | null {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : content

    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed.cardIds)) {
      return {
        cardIds: parsed.cardIds as string[],
        explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * POST /api/ai/search - 语义搜索
 */
export async function POST(request: Request) {
  try {
    let apiKey = process.env.DEEPSEEK_API_KEY
    try {
      const settingsStorage = await getSettingsStorage()
      const aiSettings = await settingsStorage.getAiSettings()
      const savedApiKey = aiSettings.apiKey?.trim()
      if (savedApiKey && isValidDeepSeekApiKey(savedApiKey)) {
        apiKey = savedApiKey
      }
    } catch {
      // 忽略设置读取失败
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: '缺少 DeepSeek API Key，请在设置中配置' },
        { status: 500 }
      )
    }

    const body = (await request.json().catch(() => null)) as SearchRequestBody | null
    if (!body || !body.boardId || !body.query?.trim() || !Array.isArray(body.lanes)) {
      return NextResponse.json(
        { error: '请求格式错误' },
        { status: 400 }
      )
    }

    const systemPrompt = buildSearchSystemPrompt()
    const userPrompt = buildSearchUserPrompt(body)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const response = await fetchWithRetry('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        thinking: { type: 'disabled' },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await response.json().catch(() => null) as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> } | null
    if (!response.ok) {
      const rawMessage = typeof data?.error?.message === 'string' ? data.error.message : 'DeepSeek 请求失败'
      return NextResponse.json({ error: rawMessage }, { status: 502 })
    }

    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'AI 返回格式异常' }, { status: 502 })
    }

    const result = parseSearchResponse(content)
    if (result === null) {
      return NextResponse.json({ error: '无法解析 AI 返回的搜索数据' }, { status: 502 })
    }

    const searchResult: SearchResponse = {
      success: true,
      cardIds: result.cardIds,
      explanation: result.explanation,
    }

    return NextResponse.json(searchResult)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'AI 请求超时，请稍后重试' }, { status: 504 })
    }
    console.error('[AI Search] Error:', error)
    return NextResponse.json({ error: 'AI 搜索服务异常' }, { status: 500 })
  }
}
