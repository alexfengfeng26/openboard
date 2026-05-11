import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { StorageAdapter, resetStorage } from './StorageAdapter'
import type { OperationLogEntry } from '@/types/ai-tools.types'

const DATA_DIR = path.join(process.cwd(), 'data')

async function cleanupTestFiles() {
  try {
    const files = await fs.readdir(DATA_DIR)
    for (const file of files) {
      if (file.startsWith('test-') && (file.endsWith('.md') || file.endsWith('.lock'))) {
        await fs.unlink(path.join(DATA_DIR, file))
      }
    }
    // Remove index to force rebuild from files on next read
    const indexPath = path.join(DATA_DIR, '_boards.json')
    try {
      await fs.unlink(indexPath)
    } catch {
      // ignore if not exists
    }
  } catch {
    // ignore
  }
}

describe('StorageAdapter', () => {
  let storage: StorageAdapter

  beforeEach(async () => {
    await cleanupTestFiles()
    resetStorage()
    storage = new StorageAdapter()
    await storage.initialize()
  })

  afterEach(async () => {
    await cleanupTestFiles()
  })

  it('createBoard creates a board with default lanes', async () => {
    const board = await storage.createBoard('Test Board')
    expect(board.title).toBe('Test Board')
    expect(board.lanes.length).toBe(3)
    expect(board.lanes[0].title).toBe('待办')
    expect(board.lanes[1].title).toBe('进行中')
    expect(board.lanes[2].title).toBe('已完成')
  })

  it('getBoard retrieves created board', async () => {
    const created = await storage.createBoard('Get Test')
    const retrieved = await storage.getBoard(created.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(created.id)
    expect(retrieved!.title).toBe('Get Test')
  })

  it('updateBoard updates board properties', async () => {
    const created = await storage.createBoard('Original')
    const updated = await storage.updateBoard(created.id, { title: 'Updated' })
    expect(updated).not.toBeNull()
    expect(updated!.title).toBe('Updated')

    const retrieved = await storage.getBoard(created.id)
    expect(retrieved!.title).toBe('Updated')
  })

  it('deleteBoard removes a board', async () => {
    const board = await storage.createBoard('To Delete')
    expect(await storage.getBoard(board.id)).not.toBeNull()

    await storage.deleteBoard(board.id)
    expect(await storage.getBoard(board.id)).toBeNull()
  })

  it('createLane adds a lane to a board', async () => {
    const board = await storage.createBoard('Lane Test')
    const newLane = await storage.createLane(board.id, 'New Lane')
    expect(newLane.title).toBe('New Lane')

    const retrieved = await storage.getBoard(board.id)
    expect(retrieved!.lanes.length).toBe(4)
    expect(retrieved!.lanes.some((l) => l.title === 'New Lane')).toBe(true)
  })

  it('updateLane updates lane title', async () => {
    const board = await storage.createBoard('Lane Update Test')
    const laneId = board.lanes[0].id
    await storage.updateLane(board.id, laneId, { title: 'Updated Lane' })

    const retrieved = await storage.getBoard(board.id)
    const lane = retrieved!.lanes.find((l) => l.id === laneId)
    expect(lane!.title).toBe('Updated Lane')
  })

  it('deleteLane removes a lane from a board', async () => {
    const board = await storage.createBoard('Lane Delete Test')
    const laneId = board.lanes[0].id
    expect(board.lanes.length).toBe(3)

    await storage.deleteLane(board.id, laneId)

    const retrieved = await storage.getBoard(board.id)
    expect(retrieved!.lanes.length).toBe(2)
    expect(retrieved!.lanes.find((l) => l.id === laneId)).toBeUndefined()
  })

  it('createCard adds a card to a lane', async () => {
    const board = await storage.createBoard('Card Test')
    const laneId = board.lanes[0].id
    const card = await storage.createCard(board.id, laneId, 'New Card', 'Description')

    expect(card.title).toBe('New Card')
    expect(card.description).toBe('Description')

    const retrieved = await storage.getBoard(board.id)
    const lane = retrieved!.lanes.find((l) => l.id === laneId)
    expect(lane!.cards.length).toBe(1)
    expect(lane!.cards[0].title).toBe('New Card')
  })

  it('updateCard updates card properties', async () => {
    const board = await storage.createBoard('Card Update Test')
    const laneId = board.lanes[0].id
    const card = await storage.createCard(board.id, laneId, 'Original Card')

    await storage.updateCard(board.id, card.id, {
      title: 'Updated Card',
      description: 'Updated Desc',
    })

    const retrieved = await storage.getBoard(board.id)
    const updatedCard = retrieved!.lanes
      .find((l) => l.id === laneId)!
      .cards.find((c) => c.id === card.id)
    expect(updatedCard!.title).toBe('Updated Card')
    expect(updatedCard!.description).toBe('Updated Desc')
  })

  it('deleteCard removes a card', async () => {
    const board = await storage.createBoard('Card Delete Test')
    const laneId = board.lanes[0].id
    const card = await storage.createCard(board.id, laneId, 'Card to Delete')
    expect(card).not.toBeNull()

    await storage.deleteCard(board.id, card.id)

    const retrieved = await storage.getBoard(board.id)
    const lane = retrieved!.lanes.find((l) => l.id === laneId)
    expect(lane!.cards.length).toBe(0)
  })

  it('archiveBoard sets archivedAt and unarchiveBoard removes it', async () => {
    const board = await storage.createBoard('Archive Test')
    expect(board.archivedAt).toBeUndefined()

    const archived = await storage.archiveBoard(board.id)
    expect(archived).not.toBeNull()
    expect(archived!.archivedAt).toBeDefined()

    const unarchived = await storage.unarchiveBoard(board.id)
    expect(unarchived).not.toBeNull()
    expect(unarchived!.archivedAt).toBeUndefined()
  })

  it('getBoards excludes archived boards by default', async () => {
    const activeBoard = await storage.createBoard('Active Board')
    const archivedBoard = await storage.createBoard('Archived Board')
    await storage.archiveBoard(archivedBoard.id)

    const boards = await storage.getBoards()
    const ids = boards.map((b) => b.id)
    expect(ids).toContain(activeBoard.id)
    expect(ids).not.toContain(archivedBoard.id)
  })

  it('getBoards(true) includes archived boards', async () => {
    const activeBoard = await storage.createBoard('Active Board 2')
    const archivedBoard = await storage.createBoard('Archived Board 2')
    await storage.archiveBoard(archivedBoard.id)

    const boards = await storage.getBoards(true)
    const ids = boards.map((b) => b.id)
    expect(ids).toContain(activeBoard.id)
    expect(ids).toContain(archivedBoard.id)
  })

  it('moveCard moves card between lanes', async () => {
    const board = await storage.createBoard('Move Test')
    const sourceLaneId = board.lanes[0].id
    const targetLaneId = board.lanes[1].id
    const card = await storage.createCard(board.id, sourceLaneId, 'Movable Card')

    expect(card.laneId).toBe(sourceLaneId)

    await storage.moveCard(board.id, card.id, targetLaneId, 0)

    const retrieved = await storage.getBoard(board.id)
    const sourceLane = retrieved!.lanes.find((l) => l.id === sourceLaneId)!
    const targetLane = retrieved!.lanes.find((l) => l.id === targetLaneId)!

    expect(sourceLane.cards.find((c) => c.id === card.id)).toBeUndefined()
    expect(targetLane.cards.find((c) => c.id === card.id)).toBeDefined()
    expect(targetLane.cards.find((c) => c.id === card.id)!.laneId).toBe(targetLaneId)
  })

  it('addOperationLog, getOperationLogs, and clearOperationLogs work correctly', async () => {
    const board = await storage.createBoard('Log Test')

    const log: OperationLogEntry = {
      id: 'log-1',
      toolName: 'create_card',
      status: 'executed',
      params: { title: 'Test' },
      timestamp: new Date().toISOString(),
    }

    await storage.addOperationLog(board.id, log)
    const logs = await storage.getOperationLogs(board.id)
    expect(logs.length).toBe(1)
    expect(logs[0].toolName).toBe('create_card')

    const cleared = await storage.clearOperationLogs(board.id)
    expect(cleared).not.toBeNull()

    const emptyLogs = await storage.getOperationLogs(board.id)
    expect(emptyLogs.length).toBe(0)
  })

  it('addOperationLog removes undefined values before writing markdown', async () => {
    const board = await storage.createBoard('Log Undefined Test')

    const log: OperationLogEntry = {
      id: 'log-undefined',
      toolName: 'automation_rule',
      status: 'executed',
      params: {
        boardId: board.id,
        cardId: undefined,
        nested: {
          laneId: undefined,
          triggerType: 'card_created',
        },
      },
      error: undefined,
      timestamp: new Date().toISOString(),
    }

    await storage.addOperationLog(board.id, log)
    const logs = await storage.getOperationLogs(board.id)

    expect(logs.length).toBe(1)
    expect(logs[0].params).toEqual({
      boardId: board.id,
      nested: {
        triggerType: 'card_created',
      },
    })
    expect('error' in logs[0]).toBe(false)
  })
})
