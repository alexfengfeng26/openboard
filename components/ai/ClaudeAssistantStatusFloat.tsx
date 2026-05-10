'use client'

import { useMemo, Fragment } from 'react'
import type { Card, Lane } from '@/lib/db'
import type { OperationLogEntry } from '@/types/ai-tools.types'
import { cn } from '@/lib/utils'

type ClaudeStatusTone = 'green' | 'amber' | 'blue' | 'red' | 'neutral'

interface ClaudeStatusItem {
  label: string
  value: string
  tone: ClaudeStatusTone
}

interface ClaudeAssistantStatus {
  office: ClaudeStatusItem
  morale: ClaudeStatusItem
  flow: ClaudeStatusItem
  completedToday: number
  totalCards: number
  helperMessage: string
}

function isBlockedLane(title: string): boolean {
  return /阻塞|blocked|blocker|停滞|待处理/i.test(title)
}

function isOverdue(card: Card): boolean {
  if (!card.dueDate) return false
  const dueDate = new Date(card.dueDate)
  if (Number.isNaN(dueDate.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate < today
}

function buildClaudeAssistantStatus(
  lanes: Lane[],
  operationLogs: OperationLogEntry[],
  isSending: boolean
): ClaudeAssistantStatus {
  const allCards = lanes.flatMap((lane) => lane.cards || [])
  const totalCards = allCards.length
  const completionLane = lanes[lanes.length - 1]
  const completedCards = completionLane?.cards?.length || 0
  const activeLanes = lanes.slice(0, Math.max(0, lanes.length - 1))
  const blockedCards = lanes
    .filter((lane) => lane !== completionLane && isBlockedLane(lane.title))
    .reduce((sum, lane) => sum + (lane.cards?.length || 0), 0)
  const overdueCount = allCards.filter(isOverdue).length
  const highPriorityCount = allCards.filter((card) => card.priority === 'high' || card.priority === 'urgent').length
  const activeLaneCount = Math.max(1, activeLanes.length || (lanes.length > 0 ? 1 : 0))
  const averageCardsPerActiveLane = totalCards / activeLaneCount
  const overloadThreshold = Math.max(6, averageCardsPerActiveLane * 1.8)
  const overloadedLaneCount = activeLanes.filter((lane) => (lane.cards?.length || 0) > overloadThreshold).length
  const recentLogs = operationLogs.slice(0, 10)
  const hasFailedLog = recentLogs.some((log) => log.status === 'failed')
  const hasPendingLog = recentLogs.some((log) => log.status === 'pending' || log.status === 'confirmed')

  const office: ClaudeStatusItem = isSending || hasPendingLog
    ? { label: '办公室状态:', value: '执行中', tone: 'blue' }
    : hasFailedLog
      ? { label: '办公室状态:', value: '需关注', tone: 'red' }
      : totalCards === 0
        ? { label: '办公室状态:', value: '空闲', tone: 'neutral' }
        : completedCards === totalCards
          ? { label: '办公室状态:', value: '完成', tone: 'green' }
          : { label: '办公室状态:', value: '进行中', tone: 'blue' }

  const riskScore = overdueCount * 2 + highPriorityCount + overloadedLaneCount * 2 + blockedCards * 2
  const morale: ClaudeStatusItem = totalCards === 0
    ? { label: '团队士气:', value: '待启动', tone: 'neutral' }
    : riskScore >= 6
      ? { label: '团队士气:', value: '紧张', tone: 'red' }
      : riskScore >= 3
        ? { label: '团队士气:', value: '稳定', tone: 'amber' }
        : { label: '团队士气:', value: '高涨', tone: 'green' }

  const activeCards = lanes
    .filter((lane) => lane !== completionLane)
    .reduce((sum, lane) => sum + (lane.cards?.length || 0), 0)
  const flow: ClaudeStatusItem = totalCards === 0
    ? { label: '任务流动:', value: '待启动', tone: 'neutral' }
    : blockedCards > 0 || overdueCount > 0 || overloadedLaneCount > 1
      ? { label: '任务流动:', value: '拥堵', tone: 'red' }
      : activeCards > 0 && completedCards === 0 && totalCards >= 5
        ? { label: '任务流动:', value: '偏慢', tone: 'amber' }
        : { label: '任务流动:', value: '顺畅', tone: 'blue' }

  const helperMessage = totalCards === 0
    ? '看板还很安静，先创建第一张卡片吧。'
    : completedCards === totalCards
      ? '所有任务都已进入最后一列，可以收工了。'
      : hasFailedLog || overdueCount > 0 || blockedCards > 0
        ? '发现风险信号，建议优先处理逾期或阻塞任务。'
        : hasPendingLog || isSending
          ? '任务正在执行中，稍等片刻查看结果。'
          : '团队配合默契！继续保持哦~'

  return {
    office,
    morale,
    flow,
    completedToday: completedCards,
    totalCards,
    helperMessage,
  }
}

export function ClaudeAssistantStatusFloat({
  lanes,
  operationLogs,
  isSending,
  className,
}: {
  lanes: Lane[]
  operationLogs: OperationLogEntry[]
  isSending: boolean
  className?: string
}) {
  const status = useMemo(
    () => buildClaudeAssistantStatus(lanes, operationLogs, isSending),
    [lanes, operationLogs, isSending]
  )
  const items = [status.office, status.morale, status.flow]

  return (
    <aside className={cn('claude-ai-status-float', className)} aria-label="当前模拟状态">
      <section className="claude-ai-status-card">
        <div className="claude-ai-card-title">当前模拟状态</div>
        <div className="claude-ai-status-grid">
          {items.map((item) => (
            <Fragment key={item.label}>
              <span>{item.label}</span>
              <strong className={`status-${item.tone}`}>
                <span className={`claude-ai-status-dot dot-${item.tone}`} />
                {item.value}
              </strong>
            </Fragment>
          ))}
          <span>今日完成:</span>
          <strong className="status-neutral">{status.completedToday} / {status.totalCards}</strong>
        </div>
        <div className="claude-ai-team-note">
          <span className="claude-ai-pixel-helper" />
          <div>{status.helperMessage} <span aria-hidden="true">✨</span></div>
        </div>
      </section>
    </aside>
  )
}
