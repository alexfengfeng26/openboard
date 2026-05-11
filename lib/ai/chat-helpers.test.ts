import { describe, expect, it } from 'vitest'
import { buildSystemContext, findTaggedCardCandidates, looksLikeNoMatchResponse, looksLikeToolIntent, parseLegacyCardActionToolCalls } from './chat-helpers'
import { PromptBuilder } from '@/lib/ai-tools'

describe('chat helpers', () => {
  it('includes per-card tags in the prompt context', () => {
    const context = buildSystemContext(
      'board-1',
      '我的看板',
      [
        {
          id: 'lane-1',
          boardId: 'board-1',
          title: '待办',
          position: 0,
          createdAt: '2026-05-11T00:00:00.000Z',
          updatedAt: '2026-05-11T00:00:00.000Z',
          cards: [
            {
              id: 'card-1',
              laneId: 'lane-1',
              title: '修复登录 Bug',
              position: 0,
              createdAt: '2026-05-11T00:00:00.000Z',
              updatedAt: '2026-05-11T00:00:00.000Z',
              tags: [
                { id: 'tag-urgent', name: '紧急', color: '#ef4444' },
                { id: 'tag-bug', name: 'Bug', color: '#f59e0b' },
              ],
            },
          ],
        } as any,
      ],
      [{ id: 'tag-urgent', name: '紧急', color: '#ef4444' }]
    )

    expect(context.currentLanes?.[0]?.cards?.[0]?.tags).toEqual([
      { id: 'tag-urgent', name: '紧急', color: '#ef4444' },
      { id: 'tag-bug', name: 'Bug', color: '#f59e0b' },
    ])
    expect(context.note).toContain('判断卡片是否命中某个标签时，必须以卡片自身的 tags 字段为准')
  })

  it('renders card tags into the system prompt', () => {
    const context = buildSystemContext(
      'board-1',
      '我的看板',
      [
        {
          id: 'lane-1',
          boardId: 'board-1',
          title: '待办',
          position: 0,
          createdAt: '2026-05-11T00:00:00.000Z',
          updatedAt: '2026-05-11T00:00:00.000Z',
          cards: [
            {
              id: 'card-1',
              laneId: 'lane-1',
              title: '修复登录 Bug',
              position: 0,
              createdAt: '2026-05-11T00:00:00.000Z',
              updatedAt: '2026-05-11T00:00:00.000Z',
              tags: [{ id: 'tag-urgent', name: '紧急', color: '#ef4444' }],
            },
          ],
        } as any,
      ],
      [{ id: 'tag-urgent', name: '紧急', color: '#ef4444' }]
    )

    const prompt = PromptBuilder.buildChatSystemPrompt(context)

    expect(prompt).toContain('标签: 紧急')
    expect(prompt).toContain('标签判断规则：如果用户提到某个标签，请优先根据卡片实际 tags 字段匹配')
    expect(prompt).toContain('如果标签筛选结果不确定，先返回候选卡片与不确定点，再等用户确认')
    expect(prompt).toContain('紧急≈urgent / 高优先级 / 优先 / p0')
  })

  it('finds tagged candidates from lane and tag intent', () => {
    const candidates = findTaggedCardCandidates(
      [
        {
          id: 'lane-1',
          boardId: 'board-1',
          title: '待办',
          position: 0,
          createdAt: '2026-05-11T00:00:00.000Z',
          updatedAt: '2026-05-11T00:00:00.000Z',
          cards: [
            {
              id: 'card-1',
              laneId: 'lane-1',
              title: '修复登录 Bug',
              position: 0,
              createdAt: '2026-05-11T00:00:00.000Z',
              updatedAt: '2026-05-11T00:00:00.000Z',
              tags: [{ id: 'tag-urgent', name: '紧急', color: '#ef4444' }],
            },
            {
              id: 'card-2',
              laneId: 'lane-1',
              title: '常规优化',
              position: 1,
              createdAt: '2026-05-11T00:00:00.000Z',
              updatedAt: '2026-05-11T00:00:00.000Z',
              tags: [{ id: 'tag-opt', name: '优化', color: '#10b981' }],
            },
          ],
        } as any,
      ],
      [
        { id: 'tag-urgent', name: '紧急', color: '#ef4444' },
        { id: 'tag-opt', name: '优化', color: '#10b981' },
      ],
      '把待办里所有紧急卡片移动到进行中'
    )

    expect(candidates).toEqual([
      {
        laneId: 'lane-1',
        laneTitle: '待办',
        cardId: 'card-1',
        cardTitle: '修复登录 Bug',
        matchedTags: ['紧急'],
      },
    ])
  })

  it('detects no-match style assistant replies', () => {
    expect(looksLikeNoMatchResponse('好的，当前没有符合条件的卡片需要移动。')).toBe(true)
    expect(looksLikeNoMatchResponse('我已经列出候选卡片')).toBe(false)
  })

  it('detects tool intent from natural language instructions', () => {
    expect(looksLikeToolIntent('把待办里所有紧急卡片移动到进行中，并打上 Bug 标签')).toBe(true)
    expect(looksLikeToolIntent('帮我总结一下当前看板状态')).toBe(false)
  })

  it('parses legacy /card action arrays into tool calls', () => {
    const calls = parseLegacyCardActionToolCalls(
      [
        '好的，确认将 **新提交** 列表视为“待办”，**确认中** 列表视为“进行中”。',
        '/card',
        '',
        '```json',
        JSON.stringify([
          {
            action: 'move',
            cardId: 'card-1',
            targetLaneId: '进行中',
          },
          {
            action: 'update',
            cardId: 'card-1',
            data: { tags: ['功能', '紧急', 'Bug'] },
          },
        ]),
        '```',
      ].join('\n'),
      'board-1',
      [
        {
          id: 'lane-1',
          boardId: 'board-1',
          title: '待办',
          position: 0,
          createdAt: '2026-05-11T00:00:00.000Z',
          updatedAt: '2026-05-11T00:00:00.000Z',
          cards: [
            {
              id: 'card-1',
              laneId: 'lane-1',
              title: '实现看板列表与卡片的基本拖拽功能',
              position: 0,
              createdAt: '2026-05-11T00:00:00.000Z',
              updatedAt: '2026-05-11T00:00:00.000Z',
              tags: [
                { id: 'tag-fn', name: '功能', color: '#3b82f6' },
                { id: 'tag-urgent', name: '紧急', color: '#ef4444' },
              ],
            },
          ],
        } as any,
        {
          id: 'lane-2',
          boardId: 'board-1',
          title: '进行中',
          position: 1,
          createdAt: '2026-05-11T00:00:00.000Z',
          updatedAt: '2026-05-11T00:00:00.000Z',
          cards: [],
        } as any,
      ],
      [
        { id: 'tag-fn', name: '功能', color: '#3b82f6' },
        { id: 'tag-urgent', name: '紧急', color: '#ef4444' },
        { id: 'tag-bug', name: 'Bug', color: '#f59e0b' },
      ]
    )

    expect(calls).toEqual([
      {
        toolName: 'move_card',
        params: {
          boardId: 'board-1',
          cardId: 'card-1',
          toLaneId: 'lane-2',
        },
      },
      {
        toolName: 'batch_update_card_tags',
        params: {
          boardId: 'board-1',
          cardIds: ['card-1'],
          addTags: [{ id: 'tag-bug', name: 'Bug', color: '#f59e0b' }],
          removeTagIds: [],
        },
      },
    ])
  })
})
