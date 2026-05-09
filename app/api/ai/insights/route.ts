import { NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'
import type { InsightsRequestBody, InsightsResponse, AiInsight } from '@/types/ai-insights.types'

export const runtime = 'nodejs'

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
 * 构建洞察生成的系统提示词
 */
function buildInsightsSystemPrompt(): string {
  return `你是一个看板项目管理专家。你的任务是分析看板数据，发现潜在问题并给出 actionable 的洞察。

## 分析维度
请从以下维度分析看板状态：

1. **停滞卡片 (stale_cards)** - 检测在某一列表中停留过久未更新的卡片
   - 判断标准：updatedAt 距离现在超过 7 天
   - severity: warning（7-14天）或 critical（超过14天）

2. **重复卡片 (duplicate_cards)** - 检测标题或描述高度相似的卡片
   - 判断标准：标题相似度高的卡片对
   - severity: info 或 warning

3. **列表过载 (lane_overload)** - 检测卡片数量过多的列表
   - 判断标准：单个列表卡片数超过 15 张
   - severity: warning（15-25张）或 critical（超过25张）

4. **工作分配不均 (unbalanced_work)** - 检测列表间卡片数量差异过大
   - 判断标准：某个列表卡片数是其他列表平均数的 2 倍以上
   - severity: info 或 warning

5. **缺少标签 (missing_tags)** - 检测没有标签的卡片占比
   - 判断标准：超过 50% 的卡片没有标签
   - severity: info

6. **建议操作 (action_suggested)** - 基于整体状态给出综合性建议
   - 例如："建议将已完成超过7天的卡片归档"
   - severity: info

## 输出格式
必须按以下 JSON 格式返回洞察列表，不要包含任何其他文字：

\`\`\`json
{
  "insights": [
    {
      "id": "stale-1",
      "type": "stale_cards",
      "severity": "warning",
      "title": "3张卡片已停滞超过7天",
      "message": "以下卡片在'进行中'列表已超过7天未更新，建议跟进处理...",
      "relatedCardIds": ["card-id-1", "card-id-2"],
      "relatedLaneId": "lane-id-1",
      "suggestedAction": {
        "label": "标记为高优先级",
        "toolName": "add_tag_to_card",
        "params": { "boardId": "...", "cardId": "...", "tagId": "..." }
      }
    }
  ]
}
\`\`\`

## 重要规则
1. 只输出 JSON，不要添加其他文字说明
2. 如果没有发现任何问题，返回空的 insights 数组
3. 最多返回 5 个最重要的洞察，按 severity 排序（critical > warning > info）
4. 洞察必须具体，引用实际的卡片标题和列表名称
5. suggestedAction 是可选的，只在有明确操作建议时提供
6. id 字段使用 "{type}-{number}" 的格式`.trim()
}

/**
 * 构建用户提示词（看板数据）
 */
function buildInsightsUserPrompt(body: InsightsRequestBody): string {
  const { boardTitle, lanes, tags } = body
  const now = new Date().toISOString()

  let prompt = `请分析以下看板数据，生成洞察报告。

当前时间: ${now}
看板名称: ${boardTitle}

## 列表与卡片数据\n`

  for (const lane of lanes) {
    prompt += `\n### ${lane.title} (ID: ${lane.id}) - ${lane.cards.length} 张卡片\n`
    for (const card of lane.cards) {
      prompt += `- [${card.id}] ${card.title}`
      if (card.description) {
        const shortDesc = card.description.length > 100 ? card.description.slice(0, 100) + '...' : card.description
        prompt += ` | 描述: ${shortDesc}`
      }
      if (card.tags && card.tags.length > 0) {
        prompt += ` | 标签: ${card.tags.map((t) => t.name).join(', ')}`
      }
      prompt += ` | 更新: ${card.updatedAt}\n`
    }
  }

  if (tags && tags.length > 0) {
    prompt += `\n## 可用标签\n${tags.map((t) => `- ${t.name} (ID: ${t.id})`).join('\n')}\n`
  }

  prompt += `\n请根据以上数据生成洞察报告。`
  return prompt
}

/**
 * 解析 AI 返回的洞察 JSON
 */
function parseInsightsResponse(content: string): AiInsight[] | null {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : content

    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed.insights)) {
      return parsed.insights as AiInsight[]
    }
    // 兼容直接返回数组的情况
    if (Array.isArray(parsed)) {
      return parsed as AiInsight[]
    }
    return null
  } catch {
    return null
  }
}

/**
 * POST /api/ai/insights - 生成看板洞察
 */
export async function POST(request: Request) {
  try {
    // 获取 API Key
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

    const body = (await request.json().catch(() => null)) as InsightsRequestBody | null
    if (!body || !body.boardId || !Array.isArray(body.lanes)) {
      return NextResponse.json(
        { error: '请求格式错误，缺少必要的 boardId 或 lanes 数据' },
        { status: 400 }
      )
    }

    const systemPrompt = buildInsightsSystemPrompt()
    const userPrompt = buildInsightsUserPrompt(body)

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
        temperature: 0.3,
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

    const insights = parseInsightsResponse(content)
    if (insights === null) {
      return NextResponse.json({ error: '无法解析 AI 返回的洞察数据' }, { status: 502 })
    }

    const result: InsightsResponse = {
      success: true,
      insights,
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'AI 请求超时，请稍后重试' }, { status: 504 })
    }
    console.error('[AI Insights] Error:', error)
    return NextResponse.json({ error: 'AI 洞察服务异常' }, { status: 500 })
  }
}
