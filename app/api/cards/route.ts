import { dbHelpers } from '@/lib/db'
import { CreateCardSchema, UpdateCardSchema } from '@/lib/validation/schema'
import { validateBody } from '@/lib/validation/api'
import { withValidation } from '@/lib/api/validate'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api/response'
import { triggerAutomation } from '@/lib/automation/trigger'
import { z } from 'zod'

/**
 * DELETE /api/cards - 删除卡片查询参数 Schema
 */
const DeleteCardQuerySchema = z.object({
  cardId: z.string().min(1),
  boardId: z.string().min(1),
})

/**
 * POST /api/cards - 创建卡片
 */
export async function POST(request: Request) {
  let rawBody: any = {}
  try {
    const clonedRequest = request.clone()
    rawBody = await clonedRequest.json()
  } catch {
    // Invalid JSON will be handled by withValidation
  }

  return withValidation(CreateCardSchema, async (data) => {
    const { boardId, laneId, title, description, tags } = data
    const { attachments, dueDate, priority } = rawBody
    const card = await dbHelpers.createCard(boardId, laneId, title, description, tags, attachments, dueDate, priority)

    // 异步触发自动化规则
    void triggerAutomation('card_created', {
      boardId,
      cardId: card.id,
      laneId,
      cardTitle: title,
    })

    return successResponse(card, 201)
  })(request)
}

/**
 * DELETE /api/cards - 删除卡片
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const queryResult = validateBody(DeleteCardQuerySchema, {
      cardId: searchParams.get('id') || searchParams.get('cardId'),
      boardId: searchParams.get('boardId'),
    })

    if (!queryResult.success) {
      return errorResponse(queryResult.error || 'Invalid query parameters', 400)
    }

    const { cardId, boardId } = queryResult.data
    await dbHelpers.deleteCard(boardId, cardId)

    // 异步触发自动化规则
    void triggerAutomation('card_deleted', {
      boardId,
      cardId,
    })

    return successResponse(null)
  } catch (error) {
    console.error('Error deleting card:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete card'
    const status = message.includes('not found') ? 404 : 500
    if (status === 404) {
      return notFoundResponse('Card')
    }
    return errorResponse(message, status)
  }
}

/**
 * PATCH /api/cards - 更新卡片
 */
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const body = await request.json().catch(() => ({}))

    // Merge query params into body for backward compatibility
    const payload = {
      ...body,
      cardId: body.cardId || searchParams.get('cardId') || searchParams.get('id'),
      boardId: body.boardId || searchParams.get('boardId'),
    }

    const result = validateBody(UpdateCardSchema, payload)
    if (!result.success) {
      return errorResponse(result.error || 'Validation failed', 400)
    }

    const { cardId, boardId, ...updates } = result.data
    const { attachments, dueDate, priority } = body
    await dbHelpers.updateCard(boardId, cardId, { ...updates, attachments, dueDate, priority })

    // 异步触发自动化规则
    void triggerAutomation('card_updated', {
      boardId,
      cardId,
      cardTitle: updates.title,
    })

    return successResponse(null)
  } catch (error) {
    console.error('Error updating card:', error)
    const message = error instanceof Error ? error.message : 'Failed to update card'
    const status = message.includes('not found') ? 404 : 500
    if (status === 404) {
      return notFoundResponse('Card')
    }
    return errorResponse(message, status)
  }
}
