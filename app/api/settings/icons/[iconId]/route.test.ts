import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getIconSettings,
  updateIconSettings,
  getBoards,
  getBoard,
  unlink,
} = vi.hoisted(() => ({
  getIconSettings: vi.fn(),
  updateIconSettings: vi.fn(),
  getBoards: vi.fn(),
  getBoard: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock('fs', () => ({
  promises: {
    unlink,
  },
}))

vi.mock('@/lib/storage/SettingsStorage', () => ({
  getSettingsStorage: vi.fn(async () => ({
    getIconSettings,
    updateIconSettings,
  })),
}))

vi.mock('@/lib/storage/StorageAdapter', () => ({
  getStorage: vi.fn(async () => ({
    getBoards,
    getBoard,
  })),
}))

import { DELETE } from './route'

describe('DELETE /api/settings/icons/[iconId]', () => {
  beforeEach(() => {
    getIconSettings.mockReset()
    updateIconSettings.mockReset()
    getBoards.mockReset()
    getBoard.mockReset()
    unlink.mockReset()

    getIconSettings.mockResolvedValue({
      icons: [{ id: 'a.svg', name: 'A', url: '/icon/a.svg' }],
      userAvatar: '/icon/user.svg',
      aiAvatar: '/icon/ai.svg',
    })
    getBoards.mockResolvedValue([])
    getBoard.mockResolvedValue(null)
    updateIconSettings.mockResolvedValue({
      icons: [],
    })
    unlink.mockResolvedValue(undefined)
  })

  it('prevents deleting icon referenced by AI avatar', async () => {
    getIconSettings.mockResolvedValue({
      icons: [{ id: 'a.svg', name: 'A', url: '/icon/a.svg' }],
      userAvatar: '/icon/user.svg',
      aiAvatar: '/icon/a.svg',
    })

    const res = await DELETE({} as never, { params: Promise.resolve({ iconId: 'a.svg' }) })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.success).toBe(false)
    expect(updateIconSettings).not.toHaveBeenCalled()
    expect(unlink).not.toHaveBeenCalled()
  })

  it('deletes icon when no references exist', async () => {
    const res = await DELETE({} as never, { params: Promise.resolve({ iconId: 'a.svg' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(updateIconSettings).toHaveBeenCalledWith({ icons: [] })
    expect(unlink).toHaveBeenCalledTimes(1)
  })
})
