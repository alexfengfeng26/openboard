import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ServerToolExecutor } from './server-executor'
import { dbHelpers } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  dbHelpers: {
    createCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    moveCard: vi.fn(),
    createLane: vi.fn(),
    updateLane: vi.fn(),
    deleteLane: vi.fn(),
    createBoard: vi.fn(),
    updateBoard: vi.fn(),
    deleteBoard: vi.fn(),
  }
}))

describe('ServerToolExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('execute - 参数验证', () => {
    it('未知工具名返回 success: false 和错误信息', async () => {
      const result = await ServerToolExecutor.execute({
        toolName: 'unknown_tool',
        params: {}
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown tool: unknown_tool')
      expect(result.toolName).toBe('unknown_tool')
    })

    it('缺少必填参数返回验证错误', async () => {
      const result = await ServerToolExecutor.execute({
        toolName: 'create_card',
        params: { boardId: 'board-1', laneId: 'lane-1' }
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('缺少必填参数')
      expect(result.error).toContain('title')
    })

    it('类型错误的参数返回验证错误', async () => {
      const result = await ServerToolExecutor.execute({
        toolName: 'create_card',
        params: { boardId: 'board-1', laneId: 'lane-1', title: 123 }
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('类型错误')
      expect(result.error).toContain('title')
    })
  })

  describe('execute - 工具执行', () => {
    it('create_card 工具执行成功', async () => {
      const mockCard = { id: 'card-1', title: 'Test Card', laneId: 'lane-1' }
      vi.mocked(dbHelpers.createCard).mockResolvedValue(mockCard)

      const result = await ServerToolExecutor.execute({
        toolName: 'create_card',
        params: { boardId: 'board-1', laneId: 'lane-1', title: 'Test Card', description: 'Desc' }
      })

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ id: 'card-1', title: 'Test Card', laneId: 'lane-1' })
      expect(dbHelpers.createCard).toHaveBeenCalledWith('board-1', 'lane-1', 'Test Card', 'Desc')
    })

    it('update_card 工具执行成功', async () => {
      vi.mocked(dbHelpers.updateCard).mockResolvedValue(undefined)

      const result = await ServerToolExecutor.execute({
        toolName: 'update_card',
        params: { boardId: 'board-1', cardId: 'card-1', title: 'Updated Title' }
      })

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ id: 'card-1', updated: true })
      expect(dbHelpers.updateCard).toHaveBeenCalledWith('board-1', 'card-1', { title: 'Updated Title' })
    })

    it('delete_card 工具执行成功', async () => {
      vi.mocked(dbHelpers.deleteCard).mockResolvedValue(undefined)

      const result = await ServerToolExecutor.execute({
        toolName: 'delete_card',
        params: { boardId: 'board-1', cardId: 'card-1' }
      })

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ cardId: 'card-1', deleted: true })
      expect(dbHelpers.deleteCard).toHaveBeenCalledWith('board-1', 'card-1')
    })

    it('create_lane 工具执行成功', async () => {
      const mockLane = { id: 'lane-1', title: 'New Lane' }
      vi.mocked(dbHelpers.createLane).mockResolvedValue(mockLane)

      const result = await ServerToolExecutor.execute({
        toolName: 'create_lane',
        params: { boardId: 'board-1', title: 'New Lane' }
      })

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ id: 'lane-1', title: 'New Lane' })
      expect(dbHelpers.createLane).toHaveBeenCalledWith('board-1', 'New Lane')
    })

    it('move_card 工具执行成功', async () => {
      vi.mocked(dbHelpers.moveCard).mockResolvedValue(undefined)

      const result = await ServerToolExecutor.execute({
        toolName: 'move_card',
        params: { boardId: 'board-1', cardId: 'card-1', toLaneId: 'lane-2' }
      })

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ cardId: 'card-1', toLaneId: 'lane-2' })
      expect(dbHelpers.moveCard).toHaveBeenCalledWith('board-1', 'card-1', 'lane-2', 0)
    })
  })

  describe('execute - 批量执行与错误处理', () => {
    it('批量执行合法请求，返回所有执行结果', async () => {
      vi.mocked(dbHelpers.createCard).mockResolvedValue({ id: 'card-1', title: 'Card 1', laneId: 'lane-1' })
      vi.mocked(dbHelpers.createLane).mockResolvedValue({ id: 'lane-2', title: 'Lane 2' })

      const requests = [
        { toolName: 'create_card', params: { boardId: 'board-1', laneId: 'lane-1', title: 'Card 1' } },
        { toolName: 'create_lane', params: { boardId: 'board-1', title: 'Lane 2' } }
      ] as const

      const results = await Promise.all(requests.map(req => ServerToolExecutor.execute(req)))

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
      expect(results[0].toolName).toBe('create_card')
      expect(results[1].toolName).toBe('create_lane')
    })

    it('单个工具执行失败不影响其他工具的执行', async () => {
      vi.mocked(dbHelpers.createCard).mockRejectedValue(new Error('DB error'))
      vi.mocked(dbHelpers.createLane).mockResolvedValue({ id: 'lane-2', title: 'Lane 2' })

      const requests = [
        { toolName: 'create_card', params: { boardId: 'board-1', laneId: 'lane-1', title: 'Card 1' } },
        { toolName: 'create_lane', params: { boardId: 'board-1', title: 'Lane 2' } }
      ] as const

      const results = await Promise.all(requests.map(req => ServerToolExecutor.execute(req)))

      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('DB error')
      expect(results[1].success).toBe(true)
      expect(results[1].result).toEqual({ id: 'lane-2', title: 'Lane 2' })
    })

    it('返回结果中包含失败工具的 success: false 和错误信息', async () => {
      vi.mocked(dbHelpers.deleteCard).mockRejectedValue(new Error('Card not found'))

      const result = await ServerToolExecutor.execute({
        toolName: 'delete_card',
        params: { boardId: 'board-1', cardId: 'non-existent' }
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Card not found')
      expect(result.toolName).toBe('delete_card')
      expect(result.params).toEqual({ boardId: 'board-1', cardId: 'non-existent' })
    })

    it('混合成功与失败的批量执行，各自返回正确状态', async () => {
      vi.mocked(dbHelpers.createCard).mockResolvedValue({ id: 'card-1', title: 'Card 1', laneId: 'lane-1' })
      // update_card 参数错误（缺少 cardId）会失败

      const requests = [
        { toolName: 'create_card', params: { boardId: 'board-1', laneId: 'lane-1', title: 'Card 1' } },
        { toolName: 'update_card', params: { boardId: 'board-1', title: 'Updated' } }
      ] as const

      const results = await Promise.all(requests.map(req => ServerToolExecutor.execute(req)))

      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toContain('缺少必填参数')
    })
  })
})
