import { getSettingsStorage } from '@/lib/storage/SettingsStorage'

export interface TagSuggestionItem {
  id: string
  name: string
  color: string
}

interface DeepSeekResponse {
  error?: {
    message?: string
  }
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface SuggestTagsOptions {
  title: string
  description?: string
  availableTags: TagSuggestionItem[]
  maxTags?: number
  aiOnly?: boolean
  requireApiKey?: boolean
  timeoutMs?: number
}

export class TagSuggestionError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'TagSuggestionError'
    this.status = status
  }
}

function isValidDeepSeekApiKey(apiKey: string): boolean {
  return /^sk-[A-Za-z0-9_-]{16,}$/.test(apiKey.trim())
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '')
}

function parseJson(content: string): unknown {
  const jsonBlock = content.match(/```json\s*([\s\S]*?)\s*```/i)
  const text = (jsonBlock ? jsonBlock[1] : content).trim()
  return JSON.parse(text)
}

function extractSuggestedTagIds(content: string): string[] {
  try {
    const parsed = parseJson(content)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string')
    }
    if (!parsed || typeof parsed !== 'object') return []
    const record = parsed as Record<string, unknown>
    const tagIds = Array.isArray(record.tagIds) ? record.tagIds : Array.isArray(record.tags) ? record.tags : []
    return tagIds.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

function buildSystemPrompt(maxTags: number): string {
  return [
    '你是卡片标签分类助手。',
    `你的任务：从“现有标签列表”中挑选最合适的标签，最多 ${maxTags} 个。`,
    '只能从候选列表中选择，绝不能创建新标签。',
    '如果无法确定，返回空数组。',
    '输出必须是 JSON，且只输出 JSON：{"tagIds":["tag-id-1","tag-id-2"]}',
  ].join('\n')
}

function buildUserPrompt(title: string, description: string, availableTags: TagSuggestionItem[]): string {
  const tagsText = availableTags.map((tag) => `- ${tag.id}: ${tag.name}`).join('\n')
  return [
    `标题: ${title || '(空)'}`,
    `描述: ${description || '(空)'}`,
    '',
    '现有标签候选：',
    tagsText,
    '',
    '请根据标题和描述返回最匹配的标签 ID 列表。',
  ].join('\n')
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
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

async function getAiConfig(): Promise<{ apiKey?: string; model: string }> {
  let apiKey = process.env.DEEPSEEK_API_KEY
  let model = 'deepseek-v4-flash'

  try {
    const settingsStorage = await getSettingsStorage()
    const aiSettings = await settingsStorage.getAiSettings()
    const savedApiKey = aiSettings.apiKey?.trim()
    if (savedApiKey && isValidDeepSeekApiKey(savedApiKey)) {
      apiKey = savedApiKey
    }
    if (typeof aiSettings.defaultModel === 'string' && aiSettings.defaultModel.trim()) {
      model = aiSettings.defaultModel
    }
  } catch {
    // Settings are optional for server-side helpers.
  }

  return { apiKey, model }
}

export function suggestTagsByKeyword(
  title: string,
  description: string,
  availableTags: TagSuggestionItem[],
  currentTagIds = new Set<string>(),
  maxTags = 3
): TagSuggestionItem[] {
  const searchText = normalizeText(`${title || ''} ${description || ''}`)
  const selected: TagSuggestionItem[] = []

  for (const tag of availableTags) {
    if (currentTagIds.has(tag.id)) continue
    const tagName = normalizeText(tag.name || '')
    if (!tagName || !searchText.includes(tagName)) continue
    selected.push(tag)
    if (selected.length >= maxTags) break
  }

  return selected
}

export async function suggestTagsForContent(options: SuggestTagsOptions): Promise<TagSuggestionItem[]> {
  const title = options.title.trim()
  const description = (options.description || '').trim()
  const maxTags = Math.max(1, Math.min(5, Number.isFinite(options.maxTags) ? Number(options.maxTags) : 3))
  const availableTags = options.availableTags.filter((tag) => {
    return !!tag && typeof tag.id === 'string' && typeof tag.name === 'string' && typeof tag.color === 'string'
  })

  if (!title && !description) {
    throw new TagSuggestionError('标题或描述不能为空', 400)
  }
  if (availableTags.length === 0) {
    return []
  }

  if (!options.aiOnly) {
    const keywordMatches = suggestTagsByKeyword(title, description, availableTags, new Set(), maxTags)
    if (keywordMatches.length > 0) return keywordMatches
  }

  const { apiKey, model } = await getAiConfig()
  if (!apiKey) {
    if (options.requireApiKey) {
      throw new TagSuggestionError('缺少 DeepSeek API Key', 500)
    }
    return []
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000)
  try {
    const response = await fetchWithRetry('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(maxTags) },
          { role: 'user', content: buildUserPrompt(title, description, availableTags) },
        ],
        temperature: 0.1,
        thinking: { type: 'disabled' },
      }),
      signal: controller.signal,
    })

    const data = (await response.json().catch(() => null)) as DeepSeekResponse | null
    if (!response.ok) {
      const message = typeof data?.error?.message === 'string' ? data.error.message : 'DeepSeek 请求失败'
      throw new TagSuggestionError(message, 502)
    }

    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      throw new TagSuggestionError('AI 返回格式异常', 502)
    }

    const availableById = new Map(availableTags.map((tag) => [tag.id, tag] as const))
    const availableByName = new Map(availableTags.map((tag) => [normalizeText(tag.name), tag] as const))
    const selected: TagSuggestionItem[] = []
    const seen = new Set<string>()

    for (const raw of extractSuggestedTagIds(content)) {
      const value = raw.trim()
      const matched = availableById.get(value) || availableByName.get(normalizeText(value))
      if (!matched || seen.has(matched.id)) continue
      selected.push(matched)
      seen.add(matched.id)
      if (selected.length >= maxTags) break
    }

    return selected
  } catch (error) {
    if (error instanceof TagSuggestionError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TagSuggestionError('AI 请求超时，请稍后重试', 504)
    }
    throw new TagSuggestionError(error instanceof Error ? error.message : 'AI 标签服务异常', 500)
  } finally {
    clearTimeout(timeoutId)
  }
}
