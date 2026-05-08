'use client'

import { useState, useCallback } from 'react'
import type { ToolCallRequest, OperationLogEntry } from '@/types/ai-tools.types'
import { toastError, toastInfo, toastSuccess, toastWarning } from '@/components/ui/toast'

export interface UseAiToolCallsOptions {
  onBoardRefresh?: () => void | Promise<void>
  setOperationLogs: React.Dispatch<React.SetStateAction<OperationLogEntry[]>>
}

export interface UseAiToolCallsReturn {
  pendingToolCalls: ToolCallRequest[] | null
  pendingToolLogIds: string[] | null
  isExecuting: boolean
  handleConfirmToolCalls: (options?: {
    confirmedBy?: 'user' | 'auto'
    toolCalls?: ToolCallRequest[]
    toolLogIds?: string[]
  }) => Promise<void>
  handleCancelToolCalls: () => void
  setPendingToolCalls: React.Dispatch<React.SetStateAction<ToolCallRequest[] | null>>
  setPendingToolLogIds: React.Dispatch<React.SetStateAction<string[] | null>>
  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>
}

export function useAiToolCalls(options: UseAiToolCallsOptions): UseAiToolCallsReturn {
  const { onBoardRefresh, setOperationLogs } = options
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallRequest[] | null>(null)
  const [pendingToolLogIds, setPendingToolLogIds] = useState<string[] | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  const handleConfirmToolCalls = useCallback(async (options?: {
    confirmedBy?: 'user' | 'auto'
    toolCalls?: ToolCallRequest[]
    toolLogIds?: string[]
  }) => {
    const toolCallsToExecute = options?.toolCalls ?? pendingToolCalls
    const logIdsToUpdate = options?.toolLogIds ?? pendingToolLogIds

    if (!toolCallsToExecute || isExecuting) return
    const confirmedBy = options?.confirmedBy || 'user'
    setIsExecuting(true)
    try {
      const affectedLogIds = logIdsToUpdate || []
      if (affectedLogIds.length > 0) {
        setOperationLogs((prev) =>
          prev.map((log) =>
            affectedLogIds.includes(log.id)
              ? { ...log, status: 'confirmed' as const, confirmedBy, timestamp: new Date().toISOString() }
              : log
          )
        )
      }
      const response = await fetch('/api/ai/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolCalls: toolCallsToExecute }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '执行失败')

      const results = data.data || []
      const timestamp = new Date().toISOString()

      setOperationLogs((prev) => {
        const updated = [...prev]
        const ids = logIdsToUpdate || []
        if (ids.length === results.length && ids.length > 0) {
          const map = new Map(updated.map((l) => [l.id, l]))
          for (let i = 0; i < results.length; i++) {
            const id = ids[i]
            const existing = map.get(id)
            if (!existing) continue
            map.set(id, {
              ...existing,
              status: results[i].success ? 'executed' : 'failed',
              result: results[i].result,
              error: results[i].error,
              timestamp,
            })
          }
          return updated.map((l) => map.get(l.id) || l)
        }
        let resultCursor = 0
        return updated.map((log) => {
          if (resultCursor >= results.length) return log
          if (log.status !== 'confirmed' && log.status !== 'pending') return log
          const r = results[resultCursor]
          resultCursor++
          return { ...log, status: r.success ? 'executed' : 'failed', result: r.result, error: r.error, timestamp }
        })
      })

      const successCount = results.filter((r: { success?: boolean }) => r.success).length
      const failCount = results.filter((r: { success?: boolean }) => !r.success).length
      if (confirmedBy === 'auto') {
        if (failCount === 0) toastSuccess(`AI 已自动执行：成功 ${successCount} 个`)
        else if (successCount > 0) toastWarning(`AI 自动执行：成功 ${successCount} 个，失败 ${failCount} 个`)
        else toastError(`AI 自动执行失败：${failCount} 个`)
      } else {
        if (failCount === 0) toastSuccess(`执行完成：成功 ${successCount} 个`)
        else if (successCount > 0) toastWarning(`执行完成：成功 ${successCount} 个，失败 ${failCount} 个`)
        else toastError(`执行失败：${failCount} 个`)
      }

      setPendingToolCalls(null)
      setPendingToolLogIds(null)
      if (onBoardRefresh) await onBoardRefresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : '执行失败'
      toastError(`执行失败：${message}`)
      const affectedLogIds = logIdsToUpdate || []
      if (affectedLogIds.length > 0) {
        setOperationLogs((prev) =>
          prev.map((log) =>
            affectedLogIds.includes(log.id)
              ? { ...log, status: 'failed', error: message, timestamp: new Date().toISOString() }
              : log
          )
        )
      }
    } finally {
      setIsExecuting(false)
    }
  }, [pendingToolCalls, pendingToolLogIds, isExecuting, onBoardRefresh, setOperationLogs])

  const handleCancelToolCalls = useCallback(() => {
    if (!pendingToolCalls) return
    const affectedLogIds = pendingToolLogIds || []
    if (affectedLogIds.length > 0) {
      setOperationLogs((prev) =>
        prev.map((log) =>
          affectedLogIds.includes(log.id)
            ? { ...log, status: 'cancelled', timestamp: new Date().toISOString() }
            : log
        )
      )
    }
    setPendingToolCalls(null)
    setPendingToolLogIds(null)
    toastInfo('已取消操作')
  }, [pendingToolCalls, pendingToolLogIds, setOperationLogs])

  return {
    pendingToolCalls,
    pendingToolLogIds,
    isExecuting,
    handleConfirmToolCalls,
    handleCancelToolCalls,
    setPendingToolCalls,
    setPendingToolLogIds,
    setIsExecuting,
  }
}
