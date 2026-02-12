import { describe, expect, it } from 'vitest'
import { ToolCallParser } from './tool-call-parser'

describe('ToolCallParser.parse', () => {
    it('parses strict tool_calls JSON', () => {
        const input = JSON.stringify({
            tool_calls: [{ toolName: 'create_card', params: { boardId: 'default-board', laneId: 'lane-todo', title: 'A' } }],
        })
        expect(ToolCallParser.parse(input)).toEqual([
            { toolName: 'create_card', params: { boardId: 'default-board', laneId: 'lane-todo', title: 'A' } },
        ])
    })

    it('parses tool_calls JSON in code block', () => {
        const input =
            '```json\n' +
            JSON.stringify({
                tool_calls: [{ toolName: 'create_card', params: { boardId: 'default-board', laneId: 'lane-todo', title: 'A' } }],
            }) +
            '\n```'
        expect(ToolCallParser.parse(input)?.length).toBe(1)
    })

    it('parses embedded tool_calls object with trailing text', () => {
        const input =
            JSON.stringify({
                tool_calls: [{ toolName: 'create_card', params: { boardId: 'default-board', laneId: 'lane-todo', title: 'A' } }],
            }) + ' 创建三张卡片失败'
        expect(ToolCallParser.parse(input)?.[0].toolName).toBe('create_card')
    })

    it('parses camelCase toolCalls for compatibility', () => {
        const input = JSON.stringify({
            toolCalls: [{ toolName: 'create_card', params: { boardId: 'default-board', laneId: 'lane-todo', title: 'A' } }],
        })
        expect(ToolCallParser.parse(input)?.length).toBe(1)
    })
})
