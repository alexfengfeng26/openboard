'use client'

import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { OperationLogEntry } from '@/types/ai-tools.types'

interface OperationLogPanelProps {
  logs: OperationLogEntry[]
  onClose?: () => void
}

/**
 * 操作日志面板 - 展示工具执行的详细日志
 */
export function OperationLogPanel({ logs, onClose }: OperationLogPanelProps) {
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-semibold">操作日志</span>
          <Badge variant="secondary">{logs.length}</Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            暂无操作记录
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span className="text-sm font-medium">{getToolDisplayName(log.toolName)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    {getStatusBadge(log.status)}
                  </div>
                </div>

                {/* 参数详情 */}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    参数详情
                  </summary>
                  <pre className="mt-1 rounded bg-muted p-2 text-xs">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
