import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateIconSettings = vi.fn()
const getIconSettings = vi.fn()

vi.mock('@/lib/storage/SettingsStorage', () => ({
  getSettingsStorage: vi.fn(async () => ({
    getIconSettings,
    updateIconSettings,
  })),
}))

import { PUT } from './route'

describe('PUT /api/settings/icons', () => {
  beforeEach(() => {
    updateIconSettings.mockReset()
    getIconSettings.mockReset()
    getIconSettings.mockResolvedValue({
      icons: [
        { id: 'user.png', name: 'user', url: '/icon/user.png' },
        { id: 'ai.png', name: 'ai', url: '/icon/ai.png' },
      ],
      userAvatar: '/icon/user.png',
      aiAvatar: '/icon/ai.png',
    })
  })

  it('updates avatar URLs as part of icon settings', async () => {
    updateIconSettings.mockImplementation(async (updates: Record<string, unknown>) => ({
      icons: [],
      ...updates,
    }))

    const req = new Request('http://localhost/api/settings/icons', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAvatar: '/icon/user.png',
        aiAvatar: '/icon/ai.png',
      }),
    })

    const res = await PUT(req as never)

    expect(res.status).toBe(200)
    expect(updateIconSettings).toHaveBeenCalledWith({
      userAvatar: '/icon/user.png',
      aiAvatar: '/icon/ai.png',
    })

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      userAvatar: '/icon/user.png',
      aiAvatar: '/icon/ai.png',
    })
  })

  it('does not clear user avatar when only AI avatar is updated', async () => {
    updateIconSettings.mockImplementation(async (updates: Record<string, unknown>) => ({
      icons: [],
      userAvatar: '/icon/user.png',
      ...updates,
    }))

    const req = new Request('http://localhost/api/settings/icons', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiAvatar: '/icon/ai.png',
      }),
    })

    const res = await PUT(req as never)

    expect(res.status).toBe(200)
    expect(updateIconSettings).toHaveBeenCalledWith({
      aiAvatar: '/icon/ai.png',
    })

    const json = await res.json()
    expect(json.data).toMatchObject({
      userAvatar: '/icon/user.png',
      aiAvatar: '/icon/ai.png',
    })
  })

  it('clears only the requested avatar when null is provided', async () => {
    updateIconSettings.mockImplementation(async (updates: Record<string, unknown>) => ({
      icons: [],
      userAvatar: '/icon/user.png',
      aiAvatar: '/icon/ai.png',
      ...updates,
    }))

    const req = new Request('http://localhost/api/settings/icons', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAvatar: null,
      }),
    })

    const res = await PUT(req as never)

    expect(res.status).toBe(200)
    expect(updateIconSettings).toHaveBeenCalledWith({
      userAvatar: undefined,
    })
    expect(updateIconSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ aiAvatar: undefined })
    )
  })

  it('rejects avatar URL that is not registered in icon library', async () => {
    const req = new Request('http://localhost/api/settings/icons', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiAvatar: '/external/not-registered.png',
      }),
    })

    const res = await PUT(req as never)

    expect(res.status).toBe(400)
    expect(updateIconSettings).not.toHaveBeenCalled()
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
