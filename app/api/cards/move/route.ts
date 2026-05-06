import { dbHelpers } from '@/lib/db'
import { MoveCardSchema } from '@/lib/validation/schema'
import { withValidation } from '@/lib/api/validate'
import { successResponse, errorResponse } from '@/lib/api/response'

export async function POST(request: Request) {
  try {
    return await withValidation(MoveCardSchema, async (body) => {
      const { boardId, cardId, toLaneId, newPosition } = body

      await dbHelpers.moveCard(boardId, cardId, toLaneId, newPosition)

      return successResponse(null)
    })(request)
  } catch (error) {
    console.error('Error moving card:', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to move card', 500)
  }
}
