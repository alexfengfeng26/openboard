import { NextResponse } from 'next/server'

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

export async function POST(request: Request) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: '缺少 DEEPSEEK_API_KEY 环境变量' }, { status: 500 })
    }

    const body = (await request.json().catch(() => null)) as ChatRequestBody | null

    const model = typeof body?.model === 'string' ? body.model : 'deepseek-chat'
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

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 流式模式：直接透传 SSE 流
    if (useStream) {
      if (!response.ok) {
        const data = await response.json().catch(() => null) as DeepSeekErrorResponse | null
        const message = typeof data?.error?.message === 'string' ? data.error.message : 'DeepSeek 请求失败'
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
      const message = typeof errorData?.error?.message === 'string' ? errorData.error.message : 'DeepSeek 请求失败'
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
    return NextResponse.json({ error: 'AI 服务异常' }, { status: 500 })
  }
}
