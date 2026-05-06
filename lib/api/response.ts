import { NextResponse } from 'next/server'
import type { ApiErrorCode } from '@/types'

/**
 * 成功响应
 */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * 错误响应
 */
export function errorResponse(error: string, status = 400, code?: ApiErrorCode) {
  return NextResponse.json({ success: false, error, code }, { status })
}

/**
 * 404 响应
 */
export function notFoundResponse(resource = 'Resource') {
  return NextResponse.json(
    { success: false, error: `${resource} not found`, code: 'NOT_FOUND' as ApiErrorCode },
    { status: 404 }
  )
}
