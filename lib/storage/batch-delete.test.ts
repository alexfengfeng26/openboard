import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StorageAdapter, resetStorage } from './StorageAdapter'

describe('BatchDeleteCards', () => {
  let storage: StorageAdapter

  beforeEach(async () => {
    resetStorage()
    storage = new StorageAdapter(0)
    await storage.initialize()
  })

  afterEach(() => {
    resetStorage()
  })

  it('should batch delete cards from a board', async () => {
    const board = await storage.createBoard('Batch Delete Test')
    const laneId = board.lanes[0].id

    const card1 = await storage.createCard(board.id, laneId, 'Card 1')
    const card2 = await storage.createCard(board.id, laneId, 'Card 2')
    const card3 = await storage.createCard(board.id, laneId, 'Card 3')

    // 重新读取看板以获取最新的卡片列表
    const boardWithCards = await storage.getBoard(board.id)
    expect(boardWithCards!.lanes[0].cards.length).toBe(3)

    await storage.batchDeleteCards(board.id, [card1.id, card3.id])

    const retrieved = await storage.getBoard(board.id)
    const lane = retrieved!.lanes.find((l) => l.id === laneId)
    expect(lane!.cards.length).toBe(1)
    expect(lane!.cards[0].id).toBe(card2.id)
  })
})
