import { randomUUID } from 'crypto'
import type {
  AiExecutionMode,
  AiExecutionPlan,
  AiExecutionPlanStep,
  ToolCallRequest,
} from '@/types/ai-tools.types'
import { getToolRiskLevel } from './tool-risk'

function createStepId() {
  return `step-${randomUUID()}`
}

function shouldConfirm(
  riskLevel: 'low' | 'medium' | 'high',
  mode: AiExecutionMode
): boolean {
  if (riskLevel === 'high') return true
  if (mode === 'conservative') return true
  if (mode === 'aggressive') return false
  return riskLevel !== 'low'
}

function isUndoableTool(toolName: string): boolean {
  return !new Set(['delete_card', 'delete_lane', 'delete_board']).has(toolName)
}

function summarize(calls: ToolCallRequest[]): string {
  const counters = new Map<string, number>()
  for (const c of calls) counters.set(c.toolName, (counters.get(c.toolName) || 0) + 1)
  const parts = Array.from(counters.entries()).map(([name, count]) => `${name} x${count}`)
  return parts.join('，')
}

export function buildExecutionPlan(
  toolCalls: ToolCallRequest[],
  mode: AiExecutionMode = 'balanced'
): AiExecutionPlan {
  const steps: AiExecutionPlanStep[] = toolCalls.map((call) => {
    const riskLevel = call.riskLevel ?? getToolRiskLevel(call.toolName)
    return {
      stepId: call.stepId ?? createStepId(),
      toolCall: {
        ...call,
        riskLevel,
        idempotencyKey: call.idempotencyKey ?? randomUUID(),
      },
      riskLevel,
      requiresConfirmation: shouldConfirm(riskLevel, mode),
      undoable: isUndoableTool(call.toolName),
    }
  })

  return {
    planId: `plan-${randomUUID()}`,
    mode,
    summary: summarize(toolCalls),
    steps,
    autoExecutable: steps.every((s) => !s.requiresConfirmation),
  }
}

