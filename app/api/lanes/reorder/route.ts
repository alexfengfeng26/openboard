import { dbHelpers } from '@/lib/db'
import { ReorderLanesSchema } from '@/lib/validation/schema'
import { withValidation } from '@/lib/api/validate'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api/response'
import type { Board } from '@/types'

export async function POST(request: Request) {
  try {
    return await withValidation(ReorderLanesSchema, async (body) => {
      const { boardId, laneIds } = body

      // 获取完整看板数据
      const board = await dbHelpers.getBoard(boardId)
      if (!board) {
        return notFoundResponse('Board')
      }

      // 创建新的 lanes 数组，按新顺序排列
      const reorderedLanes = board.lanes.map((lane) => {
        const index = laneIds.indexOf(lane.id)
        const newPosition = index === -1 ? 0 : index

        return {
          ...lane,
          position: newPosition * 1000,
          updatedAt: new Date().toISOString(),
        }
      })

      const updatedBoard: Board = {
        ...board,
        lanes: reorderedLanes,
        updatedAt: new Date().toISOString(),
      }

      await dbHelpers.updateBoard(boardId, { title: board.title, lanes: updatedBoard.lanes })

      return successResponse(updatedBoard)
    })(request)
  } catch (error) {
    console.error('Error reordering lanes:', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to reorder lanes', 500)
  }
}
