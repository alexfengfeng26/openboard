import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/ai/execute-plan', () => {
  it('does not return 500 when step params is invalid', async () => {
    const req = new Request('http://localhost/api/ai/execute-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: {
          planId: 'plan-test',
          mode: 'balanced',
          summary: 'move_card x1',
          steps: [
            {
              stepId: 'step-1',
              toolCall: {
                toolName: 'move_card',
                params: null,
              },
              riskLevel: 'medium',
              requiresConfirmation: true,
              undoable: true,
            },
          ],
          autoExecutable: false,
        },
        confirmedBy: 'user',
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data.results)).toBe(true)
    expect(json.data.results[0].success).toBe(false)
  })

  it('does not return 500 when step payload is malformed', async () => {
    const req = new Request('http://localhost/api/ai/execute-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: {
          planId: 'plan-test-2',
          mode: 'balanced',
          summary: 'invalid step',
          steps: [
            {
              stepId: 'step-bad',
              riskLevel: 'low',
              requiresConfirmation: false,
              undoable: false,
            },
          ],
          autoExecutable: true,
        },
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data.logs)).toBe(true)
    expect(json.data.logs[0].status).toBe('failed')
  })
})

