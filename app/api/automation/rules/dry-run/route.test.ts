import { describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { dbHelpers } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  dbHelpers: {
    getBoard: vi.fn(),
  },
}))

describe('POST /api/automation/rules/dry-run', () => {
  it('returns matched card count for an executable rule', async () => {
    vi.mocked(dbHelpers.getBoard).mockResolvedValue({
      id: 'board-1',
      title: 'Board',
      tags: [],
      lanes: [
        {
          id: 'lane-1',
          boardId: 'board-1',
          title: '待办',
          position: 0,
          createdAt: '',
          updatedAt: '',
          cards: [
            {
              id: 'card-1',
              laneId: 'lane-1',
              title: '修复登录 Bug',
              description: '',
              position: 0,
              createdAt: '',
              updatedAt: '',
            },
            {
              id: 'card-2',
              laneId: 'lane-1',
              title: '补充文档',
              description: '',
              position: 1,
              createdAt: '',
              updatedAt: '',
            },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    })

    const res = await POST(new Request('http://localhost/api/automation/rules/dry-run', {
      method: 'POST',
      body: JSON.stringify({
        boardId: 'board-1',
        rule: {
          name: 'Bug 自动标签',
          description: '',
          enabled: true,
          boardId: 'board-1',
          trigger: {
            type: 'card_created',
            conditions: [{ field: 'card.title', operator: 'contains', value: 'Bug' }],
          },
          actions: [{ type: 'auto_tag', params: {} }],
        },
      }),
    }))

    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual({
      executable: true,
      matchedCards: 1,
      missingMappings: [],
    })
  })

  it('reports missing mappings for unsafe direct actions', async () => {
    vi.mocked(dbHelpers.getBoard).mockResolvedValue({
      id: 'board-1',
      title: 'Board',
      tags: [],
      lanes: [],
      createdAt: '',
      updatedAt: '',
    })

    const res = await POST(new Request('http://localhost/api/automation/rules/dry-run', {
      method: 'POST',
      body: JSON.stringify({
        boardId: 'board-1',
        rule: {
          name: '缺少标签',
          description: '',
          enabled: true,
          boardId: 'board-1',
          trigger: { type: 'card_created', conditions: [] },
          actions: [{ type: 'add_tag', params: {} }],
        },
      }),
    }))

    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.executable).toBe(false)
    expect(json.data.missingMappings).toEqual(['tagId'])
  })
})
