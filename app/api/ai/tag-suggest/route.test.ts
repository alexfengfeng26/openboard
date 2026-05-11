import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/ai/tag-suggest', () => {
  it('returns 400 when title and description are both empty', async () => {
    const req = new Request('http://localhost/api/ai/tag-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '   ',
        description: '   ',
        availableTags: [{ id: 'tag-1', name: 'Bug', color: '#f59e0b' }],
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('returns empty suggestions when no available tags', async () => {
    const req = new Request('http://localhost/api/ai/tag-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '修复登录按钮点击无效',
        description: '用户反馈无法提交',
        availableTags: [],
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual([])
  })
})

