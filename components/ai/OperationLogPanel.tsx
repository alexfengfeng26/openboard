'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toastError, toastSuccess, toastWarning } from '@/components/ui/toast'
import type { OperationLogEntry } from '@/types/ai-tools.types'

interface OperationLogPanelProps {
  logs: OperationLogEntry[]
  boardId?: string
  onClose?: () => void
  onUndone?: () => void | Promise<void>
}

/**
 * 操作日志面板 - 展示工具执行的详细日志
 */
export function OperationLogPanel({ logs, boardId, onClose, onUndone }: OperationLogPanelProps) {
  const [undoingLogId, setUndoingLogId] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())

  const likelyUndoableTools = useMemo(
    () =>
      new Set([
        'create_card',
        'update_card',
        'move_card',
        'batch_update_card_tags',
        'create_lane',
        'update_lane',
        'create_board',
        'update_board',
      ]),
    []
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const hasUndoCapability = useCallback((log: OperationLogEntry) => {
    if (log.status !== 'executed') return false
    if (log.undoable === false) return false
    if (log.undoPayload) return true
    if (!boardId || !log.id) return false
    return likelyUndoableTools.has(log.toolName)
  }, [boardId, likelyUndoableTools])

  const canUndo = useCallback((log: OperationLogEntry) => {
    if (!hasUndoCapability(log)) return false
    if (!log.undoDeadline) return true
    return nowTs <= new Date(log.undoDeadline).getTime()
  }, [hasUndoCapability, nowTs])

  const formatUndoCountdown = (log: OperationLogEntry) => {
    if (!hasUndoCapability(log)) return '不可撤销'
    if (!log.undoDeadline) return '可撤销'
    const left = Math.floor((new Date(log.undoDeadline).getTime() - nowTs) / 1000)
    if (left <= 0) return '撤销已过期'
    return `可撤销（剩余 ${left}s）`
  }

  const latestUndoablePlanId = useMemo(() => {
    for (const log of logs) {
      if (log.planId && log.status === 'executed' && canUndo(log)) {
        return log.planId
      }
    }
    return null
  }, [logs, canUndo])

  const latestUndoablePlanLogs = useMemo(() => {
    if (!latestUndoablePlanId) return []
    return logs.filter((log) => log.planId === latestUndoablePlanId && log.status === 'executed' && canUndo(log))
  }, [logs, latestUndoablePlanId, canUndo])

  async function handleUndo(log: OperationLogEntry) {
    if (!hasUndoCapability(log)) {
      toastWarning('该操作不支持撤销')
      return
    }
    if (!canUndo(log)) {
      toastWarning('撤销窗口已过期')
      return
    }
    if (!boardId) {
      toastError('缺少 boardId，无法撤销')
      return
    }
    setUndoingLogId(log.id)
    try {
      const response = await fetch('/api/ai/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          logId: log.id,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || '撤销失败')
      }
      toastSuccess('撤销成功')
      await onUndone?.()
    } catch (e) {
      toastError(e instanceof Error ? e.message : '撤销失败')
    } finally {
      setUndoingLogId(null)
    }
  }

  const getStatusIcon = (status: OperationLogEntry['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      case 'confirmed':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'executed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusText = (status: OperationLogEntry['status']) => {
    const map: Record<OperationLogEntry['status'], string> = {
      pending: '等待确认',
      confirmed: '已确认',
      executed: '执行成功',
      failed: '执行失败',
      cancelled: '已取消'
    }
    return map[status]
  }

  const getStatusBadge = (status: OperationLogEntry['status']) => {
    const variantMap: Record<OperationLogEntry['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      confirmed: 'secondary',
      executed: 'default',
      failed: 'destructive',
      cancelled: 'outline'
    }
    return <Badge variant={variantMap[status]}>{getStatusText(status)}</Badge>
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getToolDisplayName = (toolName: string): string => {
    const nameMap: Record<string, string> = {
      create_card: '创建卡片',
      update_card: '更新卡片',
      move_card: '移动卡片',
      batch_update_card_tags: '批量更新标签',
      delete_card: '删除卡片',
      create_lane: '创建列表',
      delete_lane: '删除列表',
      update_lane: '更新列表',
      create_board: '创建看板',
      delete_board: '删除看板',
      update_board: '更新看板',
    }
    return nameMap[toolName] || toolName
  }

  async function handleUndoLatestPlan() {
    if (!boardId) {
      toastError('缺少 boardId，无法撤销')
      return
    }
    if (!latestUndoablePlanId || latestUndoablePlanLogs.length === 0) {
      toastWarning('没有可撤销的最近计划')
      return
    }

    setUndoingLogId(`plan:${latestUndoablePlanId}`)
    let success = 0
    let failed = 0

    for (const log of latestUndoablePlanLogs) {
      try {
        const response = await fetch('/api/ai/undo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boardId,
            logId: log.id,
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data?.success) {
          failed++
        } else {
          success++
        }
      } catch {
        failed++
      }
    }

    setUndoingLogId(null)
    if (success > 0 && failed === 0) toastSuccess(`已撤销最近计划（${success} 项）`)
    else if (success > 0) toastWarning(`部分撤销成功：${success} 成功，${failed} 失败`)
    else toastError('撤销最近计划失败')
    await onUndone?.()
  }

  return (
    <div className="flex h-full flex-col rounded-[20px] border border-border/90 bg-white/92 shadow-[0_18px_40px_rgba(26,20,14,0.12)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span className="text-[13px] font-semibold">操作日志</span>
          <Badge variant="secondary">{logs.length}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {latestUndoablePlanId && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-lg px-2.5 text-[11px]"
              onClick={() => void handleUndoLatestPlan()}
              disabled={undoingLogId?.startsWith('plan:')}
            >
              {undoingLogId?.startsWith('plan:') ? '撤销中...' : '撤销最近计划'}
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2.5 text-[11px]" onClick={onClose}>
              关闭
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            暂无操作记录
          </div>
        ) : (
          <div className="space-y-2.5">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-border/85 bg-card/95 p-3 shadow-[0_4px_12px_rgba(26,20,14,0.05)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span className="text-[13px] font-medium">{getToolDisplayName(log.toolName)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    {getStatusBadge(log.status)}
                  </div>
                </div>

                {/* 参数详情 */}
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground">
                    参数详情
                  </summary>
                  <pre className="mt-1 rounded-lg bg-muted/75 p-2 text-[11px]">
                    {JSON.stringify(log.params, null, 2)}
                  </pre>
                </details>

                {/* Execution result or error */}
                {log.status === 'failed' && log.error ? (
                  <div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                    {String(log.error)}
                  </div>
                ) : null}

                {log.status === 'executed' && log.result ? (
                  <div className="mt-2 rounded-md bg-green-500/10 p-2 text-xs text-green-700 dark:text-green-400">
                    {JSON.stringify(log.result, null, 2)}
                  </div>
                ) : null}

                {log.status === 'executed' && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {formatUndoCountdown(log)}
                    </span>
                    {hasUndoCapability(log) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => void handleUndo(log)}
                        disabled={!canUndo(log) || undoingLogId === log.id}
                      >
                        {undoingLogId === log.id ? '撤销中...' : '撤销'}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">-</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
