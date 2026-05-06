import { z } from 'zod'
import { dbHelpers } from '@/lib/db'
import { CreateLaneSchema, UpdateLaneSchema } from '@/lib/validation/schema'
import { validateBody } from '@/lib/validation/api'
import { withValidation } from '@/lib/api/validate'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api/response'

/**
 * POST /api/lanes - 创建列表
 */
export async function POST(request: Request) {
  return withValidation(CreateLaneSchema, async (data) => {
    const lane = await dbHelpers.createLane(data.boardId, data.title)
    return successResponse(lane, 201)
  })(request)
}

/**
 * 删除列表查询参数 Schema
 */
const DeleteLaneQuerySchema = z.object({
  laneId: z.string().min(1),
  boardId: z.string().min(1),
})

/**
 * DELETE /api/lanes - 删除列表
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const queryResult = validateBody(DeleteLaneQuerySchema, {
      laneId: searchParams.get('id') || searchParams.get('laneId'),
      boardId: searchParams.get('boardId'),
    })

    if (!queryResult.success) {
      return errorResponse(queryResult.error || 'Invalid query parameters', 400)
    }

    const { laneId, boardId } = queryResult.data
    await dbHelpers.deleteLane(boardId, laneId)
    return successResponse(null)
  } catch (error) {
    console.error('Error deleting lane:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete lane'
    const status = message.includes('not found') ? 404 : 500
    if (status === 404) {
      return notFoundResponse('Lane')
    }
    return errorResponse(message, status)
  }
}

/**
 * PATCH /api/lanes - 更新列表
 */
export async function PATCH(request: Request) {
  return withValidation(UpdateLaneSchema, async (data) => {
    const { boardId, laneId, title } = data
    await dbHelpers.updateLane(boardId, laneId, { title })
    return successResponse(null)
  })(request)
}
