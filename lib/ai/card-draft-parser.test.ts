import { describe, expect, it } from 'vitest'
import { parseCardDraftItemsFromAiContent } from './card-draft-parser'

describe('parseCardDraftItemsFromAiContent', () => {
    it('parses strict JSON array', () => {
        const input = '[{"title":"任务A","description":"描述A"}]'
        expect(parseCardDraftItemsFromAiContent(input)).toEqual([{ title: '任务A', description: '描述A' }])
    })

    it('parses JSON from fenced code block', () => {
        const input = '一些说明\n```json\n[{"title":"任务A","description":"描述A"}]\n```\n更多说明'
        expect(parseCardDraftItemsFromAiContent(input)).toEqual([{ title: '任务A', description: '描述A' }])
    })

    it('parses JSON array embedded in text', () => {
        const input = '输出如下：\n[{"title":"任务A","description":"描述A"},{"title":"任务B"}]\n结束'
        expect(parseCardDraftItemsFromAiContent(input)).toEqual([
            { title: '任务A', description: '描述A' },
            { title: '任务B', description: undefined },
        ])
    })

    it('parses markdown table', () => {
        const input = [
            '| 标题 | 描述 |',
            '| --- | --- |',
            '| 任务A | 做A |',
            '| 任务B | 做B |',
        ].join('\n')

        expect(parseCardDraftItemsFromAiContent(input)).toEqual([
            { title: '任务A', description: '做A' },
            { title: '任务B', description: '做B' },
        ])
    })

    it('parses key-value cards', () => {
        const input = [
            '1）标题：任务A',
            '描述：做A',
            '',
            '2) title: 任务B',
            'description: 做B',
        ].join('\n')

        expect(parseCardDraftItemsFromAiContent(input)).toEqual([
            { title: '任务A', description: '做A' },
            { title: '任务B', description: '做B' },
        ])
    })

    it('parses numbered markdown cards', () => {
        const input = ['**1. 任务A**', '- 做A', '', '**2）任务B**', '- 做B'].join('\n')
        expect(parseCardDraftItemsFromAiContent(input)).toEqual([
            { title: '任务A', description: '做A' },
            { title: '任务B', description: '做B' },
        ])
    })
})
