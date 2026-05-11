import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/ai/plan', () => {
  it('builds execution plan from tool calls', async () => {
    const req = new Request('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'balanced',
        toolCalls: [
          { toolName: 'create_card', params: { boardId: 'b1', laneId: 'l1', title: 'x' } },
        ],
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.planId).toMatch(/^plan-/)
    expect(Array.isArray(json.data.steps)).toBe(true)
    expect(json.data.steps.length).toBe(1)
    expect(json.data.steps[0].toolCall.toolName).toBe('create_card')
  })

  it('returns 400 on empty tool calls', async () => {
    const req = new Request('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolCalls: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

