import { describe, expect, it } from 'vitest'
import { createDefaultAiCommands, normalizeAiCommands, parseAiCommandsFromText } from './commands'

describe('ai commands', () => {
  it('parses commands from json array', () => {
    const text = JSON.stringify([
      {
        id: '1',
        trigger: '/x',
        kind: 'snippet',
        label: '/x',
        insertText: 'hello',
        enabled: true,
        placement: 'slash',
      },
    ])
    const parsed = parseAiCommandsFromText(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.trigger).toBe('/x')
  })

  it('parses commands from markdown json block', () => {
    const text = ['# test', '```json', JSON.stringify([{ id: '1', trigger: '/kb', kind: 'tool_prefix', scope: 'all', label: '/kb', insertText: '/kb ', enabled: true, placement: 'slash' }]), '```'].join('\n')
    const parsed = parseAiCommandsFromText(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.kind).toBe('tool_prefix')
  })

  it('normalizes and de-dupes by trigger case-insensitively', () => {
    const normalized = normalizeAiCommands([
      {
        id: '1',
        trigger: '/KB',
        kind: 'snippet',
        label: '/KB',
        insertText: 'a',
        enabled: true,
        placement: 'slash',
      },
      {
        id: '2',
        trigger: '/kb',
        kind: 'snippet',
        label: '/kb',
        insertText: 'b',
        enabled: true,
        placement: 'slash',
      },
    ] as any)
    expect(normalized).toHaveLength(1)
    expect(normalized[0]?.insertText).toBe('a')
  })

  it('drops invalid tool_prefix without scope', () => {
    const normalized = normalizeAiCommands([
      {
        id: '1',
        trigger: '/card',
        kind: 'tool_prefix',
        label: '/card',
        insertText: '/card ',
        enabled: true,
        placement: 'slash',
      },
    ] as any)
    expect(normalized).toHaveLength(0)
  })

  it('creates default commands', () => {
    const defaults = createDefaultAiCommands()
    expect(defaults.length).toBeGreaterThanOrEqual(4)
    expect(defaults.some((c) => c.kind === 'tool_prefix')).toBe(true)
  })
})

