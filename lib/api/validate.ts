import type { ZodSchema } from 'zod'
import { NextResponse } from 'next/server'
import { validateBody } from '@/lib/validation/api'
import { errorResponse } from './response'

/**
 * 高阶函数：自动解析 JSON body，Zod 验证，错误时返回 400
 * 用于 Next.js API 路由
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: (data: T) => Promise<NextResponse> | NextResponse
) {
  return async (request: Request): Promise<NextResponse> => {
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }

    const result = validateBody(schema, body)

    if (!result.success) {
      return errorResponse(result.error || 'Validation failed', 400)
    }

    return handler(result.data as T)
  }
}
