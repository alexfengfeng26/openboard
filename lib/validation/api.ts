import type { ZodSchema, z } from 'zod'
import { NextResponse } from 'next/server'

export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 验证请求体
 */
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): ValidationResult<T> {
  const result = schema.safeParse(body)

  if (!result.success) {
    const messages = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    return { success: false, error: messages }
  }

  return { success: true, data: result.data }
}

/**
 * 高阶函数：用于 Next.js API 路由的验证包装器
 * handler 接收验证后的数据，返回 NextResponse
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: (data: T) => Promise<NextResponse> | NextResponse
) {
  return async (body: unknown): Promise<NextResponse> => {
    const result = validateBody(schema, body)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return handler(result.data as T)
  }
}
