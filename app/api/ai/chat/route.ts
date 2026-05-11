import { NextResponse } from 'next/server'
import { getSettingsStorage } from '@/lib/storage/SettingsStorage'

export const runtime = 'nodejs'

type IncomingMessage = { role: 'user' | 'assistant' | 'system'; content: string }

interface ChatRequestBody {
  model?: string
  system?: string
  messages?: IncomingMessage[]
  temperature?: number
  stream?: boolean
}

interface DeepSeekErrorResponse {
  error?: {
    message?: string
  }
}

interface DeepSeekSuccessResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

function shouldDisableThinking(model: string): boolean {
  return model === 'deepseek-v4-flash' || model === 'deepseek-v4-pro'
}

function isValidDeepSeekApiKey(apiKey: string): boolean {
  return /^sk-[A-Za-z0-9_-]{16,}$/.test(apiKey.trim())
}

/**
 * 格式化 DeepSeek 错误信息，给用户提供更友好的中文提示
 */
function formatDeepSeekError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('too busy') || lower.includes('service unavailable') || lower.includes('overloaded')) {
    return 'DeepSeek 服务器繁忙，请稍后重试，或切换到其他模型（如 V4 Flash）'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return '请求频率过快，请稍等片刻再试'
  }
  if (lower.includes('invalid api key') || lower.includes('authentication')) {
    return 'API Key 无效，请检查设置中的 DeepSeek API Key'
  }
  if (lower.includes('context length') || lower.includes('too long')) {
    return '对话内容过长，请尝试清空对话或缩短输入'
  }
  return message
}

/**
 * 带重试的 DeepSeek 请求
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      // 如果是 502/503/429，且还有重试次数，则等待后重试
      if ((response.status === 502 || response.status === 503 || response.status === 429) && i < maxRetries) {
        const delay = 1000 * Math.pow(2, i) // 指数退避: 1s, 2s
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

export async function POST(request: Request) {
  try {
    // 优先使用用户设置的 API Key 和默认模型
    let apiKey = process.env.DEEPSEEK_API_KEY
    let defaultModel = 'deepseek-v4-flash'
    try {
      const settingsStorage = await getSettingsStorage()
      const aiSettings = await settingsStorage.getAiSettings()
      const savedApiKey = aiSettings.apiKey?.trim()
      if (savedApiKey && isValidDeepSeekApiKey(savedApiKey)) {
        apiKey = savedApiKey
      }
      if (aiSettings.defaultModel) {
        defaultModel = aiSettings.defaultModel
      }
    } catch {
      // 忽略设置读取失败，使用环境变量和硬编码默认值
    }
    if (!apiKey) {
      return NextResponse.json({ error: '缺少 DeepSeek API Key，请在设置中配置或设置 DEEPSEEK_API_KEY 环境变量' }, { status: 500 })
    }

    const body = (await request.json().catch(() => null)) as ChatRequestBody | null

    const model = typeof body?.model === 'string' ? body.model : defaultModel
    const system = typeof body?.system === 'string' ? body.system : ''
    const messages = Array.isArray(body?.messages) ? body!.messages : []
    const temperature = typeof body?.temperature === 'number' ? body.temperature : 0.4
    const useStream = body?.stream === true

    const sanitized = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content }))

    const outgoing = system ? [{ role: 'system' as const, content: system }, ...sanitized] : sanitized

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const response = await fetchWithRetry('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: outgoing,
        stream: useStream,
        temperature,
        ...(shouldDisableThinking(model) ? { thinking: { type: 'disabled' } } : {}),
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 流式模式：直接透传 SSE 流
    if (useStream) {
      if (!response.ok) {
        const data = await response.json().catch(() => null) as DeepSeekErrorResponse | null
        const rawMessage = typeof data?.error?.message === 'string' ? data.error.message : 'DeepSeek 请求失败'
        const message = formatDeepSeekError(rawMessage)
        return NextResponse.json({ error: message }, { status: 502 })
      }
      if (!response.body) {
        return NextResponse.json({ error: '无法获取响应流' }, { status: 502 })
      }
      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }

    // 非流式模式：解析完整响应
    const data = await response.json().catch(() => null) as DeepSeekErrorResponse | DeepSeekSuccessResponse | null
    if (!response.ok) {
      const errorData = data as DeepSeekErrorResponse
      const rawMessage = typeof errorData?.error?.message === 'string' ? errorData.error.message : 'DeepSeek 请求失败'
      const message = formatDeepSeekError(rawMessage)
      return NextResponse.json({ error: message }, { status: 502 })
    }

    const successData = data as DeepSeekSuccessResponse
    const content = successData?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'DeepSeek 返回格式异常' }, { status: 502 })
    }

    return NextResponse.json({ content })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'AI 请求超时，请稍后重试' }, { status: 504 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 服务异常' },
      { status: 500 }
    )
  }
}
