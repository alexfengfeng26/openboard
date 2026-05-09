import { dbHelpers } from '@/lib/db'
import { MoveCardSchema } from '@/lib/validation/schema'
import { withValidation } from '@/lib/api/validate'
import { successResponse, errorResponse } from '@/lib/api/response'
import { triggerAutomation } from '@/lib/automation/trigger'

export async function POST(request: Request) {
  try {
    return await withValidation(MoveCardSchema, async (body) => {
      const { boardId, cardId, toLaneId, newPosition } = body

      const board = await dbHelpers.getBoard(boardId)
      const card = board?.lanes.flatMap((l) => l.cards).find((c) => c.id === cardId)
      const fromLaneId = card?.laneId

      await dbHelpers.moveCard(boardId, cardId, toLaneId, newPosition)

      // 异步触发自动化规则
      void triggerAutomation('card_moved', {
        boardId,
        cardId,
        fromLaneId,
        toLaneId,
        cardTitle: card?.title,
      })

      return successResponse(null)
    })(request)
  } catch (error) {
    console.error('Error moving card:', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to move card', 500)
  }
}
