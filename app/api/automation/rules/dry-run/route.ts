import { NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/db'
import { RuleEngine } from '@/lib/automation/RuleEngine'
import type { AutomationRule, AutomationTriggerType, TriggerContext } from '@/types/automation.types'

interface DryRunRequest {
  boardId?: string
  rule?: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'> | AutomationRule
  triggerType?: AutomationTriggerType
}

function createContext(boardId: string, card: { id: string; laneId: string; title: string; description?: string }, triggerType: AutomationTriggerType): TriggerContext {
  return {
    boardId,
    cardId: card.id,
    laneId: card.laneId,
    toLaneId: triggerType === 'card_moved' ? card.laneId : undefined,
    cardTitle: card.title,
    cardDescription: card.description,
  }
}

function findMissingMappings(rule: DryRunRequest['rule']): string[] {
  const missing: string[] = []
  for (const action of rule?.actions || []) {
    if (action.type === 'move_card' && typeof action.params.targetLaneId !== 'string') {
      missing.push('targetLaneId')
    }
    if ((action.type === 'add_tag' || action.type === 'remove_tag') && typeof action.params.tagId !== 'string') {
      missing.push('tagId')
    }
  }
  return Array.from(new Set(missing))
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as DryRunRequest
    const { boardId, rule } = body
    if (!boardId || !rule?.trigger || !Array.isArray(rule.actions)) {
      return NextResponse.json({ success: false, error: '缺少 boardId 或规则草稿' }, { status: 400 })
    }

    const board = await dbHelpers.getBoard(boardId)
    if (!board) {
      return NextResponse.json({ success: false, error: '看板不存在' }, { status: 404 })
    }

    const triggerType = body.triggerType || rule.trigger.type
    const draftRule: AutomationRule = {
      id: 'dry-run-rule',
      name: rule.name || '规则预览',
      description: rule.description || '',
      enabled: true,
      trigger: rule.trigger,
      actions: rule.actions,
      boardId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    let matchedCards = 0
    for (const lane of board.lanes) {
      for (const card of lane.cards || []) {
        if (RuleEngine.evaluateTrigger(draftRule, triggerType, createContext(boardId, card, triggerType))) {
          matchedCards++
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        executable: findMissingMappings(rule).length === 0,
        matchedCards,
        missingMappings: findMissingMappings(rule),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '规则预览失败' },
      { status: 500 }
    )
  }
}

