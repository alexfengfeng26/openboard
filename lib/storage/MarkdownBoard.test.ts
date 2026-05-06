import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { MarkdownBoard } from './MarkdownBoard'
import type { Board } from '@/types'

const TEST_DIR = path.join(process.cwd(), 'data')
const TEST_BOARD_ID = 'test-markdown-board'

function createTestBoard(id: string): Board {
  return {
    id,
    title: 'Test Board',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    tags: [{ id: 'tag-1', name: 'urgent', color: '#ef4444' }],
    lanes: [
      {
        id: 'lane-1',
        boardId: id,
        title: 'To Do',
        position: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        cards: [
          {
            id: 'card-1',
            laneId: 'lane-1',
            title: 'Test Card',
            description: 'A test card',
            position: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            tags: [{ id: 'tag-1', name: 'urgent', color: '#ef4444' }],
          },
        ],
      },
    ],
  }
}

async function cleanupTestFile(boardId: string) {
  const filePath = path.join(TEST_DIR, `${boardId}.md`)
  try {
    await fs.unlink(filePath)
  } catch {
    // ignore if not exists
  }
}

describe('MarkdownBoard', () => {
  beforeEach(async () => {
    await cleanupTestFile(TEST_BOARD_ID)
  })

  afterEach(async () => {
    await cleanupTestFile(TEST_BOARD_ID)
  })

  it('write and read round-trip serialization', async () => {
    const board = createTestBoard(TEST_BOARD_ID)
    await MarkdownBoard.write(board)
    const read = await MarkdownBoard.read(TEST_BOARD_ID)
    expect(read).not.toBeNull()
    expect(read!.id).toBe(board.id)
    expect(read!.title).toBe(board.title)
    expect(read!.lanes.length).toBe(board.lanes.length)
    expect(read!.lanes[0].cards.length).toBe(board.lanes[0].cards.length)
    expect(read!.lanes[0].cards[0].title).toBe(board.lanes[0].cards[0].title)
  })

  it('parseBoard parses markdown with frontmatter', () => {
    const markdown = `---
id: test-board
title: Parsed Board
createdAt: "2024-01-01T00:00:00.000Z"
updatedAt: "2024-01-01T00:00:00.000Z"
tags: []
lanes:
  - id: lane-1
    title: Lane One
    position: 0
    createdAt: "2024-01-01T00:00:00.000Z"
    updatedAt: "2024-01-01T00:00:00.000Z"
    cards:
      - id: card-1
        laneId: lane-1
        title: Card One
        position: 0
        createdAt: "2024-01-01T00:00:00.000Z"
        updatedAt: "2024-01-01T00:00:00.000Z"
---
`
    const parsed = (MarkdownBoard as any).parseBoard(markdown)
    expect(parsed.id).toBe('test-board')
    expect(parsed.title).toBe('Parsed Board')
    expect(parsed.lanes.length).toBe(1)
    expect(parsed.lanes[0].cards.length).toBe(1)
    expect(parsed.lanes[0].cards[0].title).toBe('Card One')
  })

  it('serializeBoard generates correct markdown with empty body', () => {
    const board = createTestBoard('test-serialize')
    const markdown = (MarkdownBoard as any).serializeBoard(board)
    expect(markdown).toContain('---')
    expect(markdown).toContain(`id: ${board.id}`)
    expect(markdown).toContain(`title: ${board.title}`)

    // Body should be empty (only frontmatter)
    const body = markdown.replace(/^---[\s\S]*?---/, '').trim()
    expect(body).toBe('')
  })

  it('exists checks file existence', async () => {
    const board = createTestBoard(TEST_BOARD_ID)
    expect(await MarkdownBoard.exists(TEST_BOARD_ID)).toBe(false)
    await MarkdownBoard.write(board)
    expect(await MarkdownBoard.exists(TEST_BOARD_ID)).toBe(true)
  })

  it('delete removes file', async () => {
    const board = createTestBoard(TEST_BOARD_ID)
    await MarkdownBoard.write(board)
    expect(await MarkdownBoard.exists(TEST_BOARD_ID)).toBe(true)
    await MarkdownBoard.delete(TEST_BOARD_ID)
    expect(await MarkdownBoard.exists(TEST_BOARD_ID)).toBe(false)
  })
})
