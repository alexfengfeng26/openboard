import { describe, expect, it } from 'vitest'
import { appendCacheBuster } from './avatar'

describe('appendCacheBuster', () => {
  it('adds cache key to relative urls', () => {
    expect(appendCacheBuster('/icon/avatar.png', 123)).toBe('/icon/avatar.png?v=123')
  })

  it('preserves existing query parameters', () => {
    expect(appendCacheBuster('/icon/avatar.png?x=1', 123)).toBe('/icon/avatar.png?x=1&v=123')
  })

  it('leaves data and blob urls unchanged', () => {
    expect(appendCacheBuster('data:image/png;base64,abc', 123)).toBe('data:image/png;base64,abc')
    expect(appendCacheBuster('blob:https://example.com/abc', 123)).toBe('blob:https://example.com/abc')
  })
})
