import { describe, it, expect } from 'vitest'
import {
  resolveVariables,
  resolveVariablesAsync,
  extractVariables,
  getBuiltinVariables,
  isValidVariable,
} from './variable-resolver'
import type { TemplateVariableContext } from '@/types/template.types'

describe('variable-resolver', () => {
  const context: TemplateVariableContext = {
    board: { id: 'board-123', title: 'Sprint 25' },
    lane: { id: 'lane-456', title: '进行中' },
    card: { id: 'card-789', title: '修复登录bug' },
    user: { name: '张三', id: 'user-001' },
  }

  describe('resolveVariables', () => {
    it('should resolve board.title', () => {
      const text = '看板：{{board.title}}'
      expect(resolveVariables(text, context)).toBe('看板：Sprint 25')
    })

    it('should resolve board.id', () => {
      const text = '{{board.id}}'
      expect(resolveVariables(text, context)).toBe('board-123')
    })

    it('should resolve lane.title', () => {
      const text = '列表：{{lane.title}}'
      expect(resolveVariables(text, context)).toBe('列表：进行中')
    })

    it('should resolve card.title', () => {
      const text = '卡片：{{card.title}}'
      expect(resolveVariables(text, context)).toBe('卡片：修复登录bug')
    })

    it('should resolve user.name', () => {
      const text = '用户：{{user.name}}'
      expect(resolveVariables(text, context)).toBe('用户：张三')
    })

    it('should resolve date.today', () => {
      const text = '{{date.today}}'
      const result = resolveVariables(text, context)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should resolve date.tomorrow', () => {
      const text = '{{date.tomorrow}}'
      const result = resolveVariables(text, context)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should resolve date.now', () => {
      const text = '{{date.now}}'
      const result = resolveVariables(text, context)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should use fallback when variable is unknown', () => {
      const text = '{{unknown.variable|默认值}}'
      expect(resolveVariables(text, context)).toBe('默认值')
    })

    it('should keep original when unknown and no fallback', () => {
      const text = '{{unknown.variable}}'
      expect(resolveVariables(text, context)).toBe('{{unknown.variable}}')
    })

    it('should use fallback when context value is empty', () => {
      const text = '{{user.name|匿名}}'
      expect(resolveVariables(text, {})).toBe('匿名')
    })

    it('should resolve multiple variables', () => {
      const text = '看板"{{board.title}}"的"{{lane.title}}"列'
      expect(resolveVariables(text, context)).toBe('看板"Sprint 25"的"进行中"列')
    })

    it('should handle empty string', () => {
      expect(resolveVariables('', context)).toBe('')
    })

    it('should handle text without variables', () => {
      const text = '普通文本'
      expect(resolveVariables(text, context)).toBe('普通文本')
    })
  })

  describe('resolveVariablesAsync', () => {
    it('should resolve variables asynchronously', async () => {
      const text = '{{board.title}} - {{lane.title}}'
      const result = await resolveVariablesAsync(text, context)
      expect(result).toBe('Sprint 25 - 进行中')
    })

    it('should handle unknown variables with fallback', async () => {
      const text = '{{unknown|fallback}}'
      const result = await resolveVariablesAsync(text, context)
      expect(result).toBe('fallback')
    })
  })

  describe('extractVariables', () => {
    it('should extract all variable names', () => {
      const text = '{{board.title}} {{lane.title}} {{board.title}}'
      expect(extractVariables(text)).toEqual(['board.title', 'lane.title'])
    })

    it('should extract variables with fallback', () => {
      const text = '{{board.title|默认}} {{unknown}}'
      expect(extractVariables(text)).toEqual(['board.title', 'unknown'])
    })

    it('should return empty array for no variables', () => {
      expect(extractVariables('no variables')).toEqual([])
    })
  })

  describe('getBuiltinVariables', () => {
    it('should return all builtin variables', () => {
      const vars = getBuiltinVariables()
      expect(vars.length).toBeGreaterThan(0)
      expect(vars.some((v) => v.name === 'board.title')).toBe(true)
      expect(vars.some((v) => v.name === 'date.today')).toBe(true)
    })
  })

  describe('isValidVariable', () => {
    it('should return true for valid variables', () => {
      expect(isValidVariable('board.title')).toBe(true)
      expect(isValidVariable('date.today')).toBe(true)
    })

    it('should return false for invalid variables', () => {
      expect(isValidVariable('invalid')).toBe(false)
      expect(isValidVariable('')).toBe(false)
    })
  })
})
