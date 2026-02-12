import { describe, expect, it } from 'vitest'
import { POST } from './route'
 
describe('POST /api/ai/tools/execute', () => {
  it('accepts snake_case tool_calls', async () => {
    const req = new Request('http://localhost/api/ai/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_calls: [{ toolName: 'unknown_tool', params: {} }],
      }),
    })
 
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data[0].success).toBe(false)
  })
 
  it('accepts camelCase toolCalls', async () => {
    const req = new Request('http://localhost/api/ai/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolCalls: [{ toolName: 'unknown_tool', params: {} }],
      }),
    })
 
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data[0].success).toBe(false)
  })
})
