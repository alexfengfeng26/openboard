'use client'

import { useState, useEffect, useCallback } from 'react'
import type { OperationLogEntry } from '@/types/ai-tools.types'

const STORAGE_KEY = 'kanban.operationLogs'
const MAX_LOGS = 100

export function useOperationLogs(boardId?: string) {
  const [logs, setLogs] = useState<OperationLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showLogPanel, setShowLogPanel] = useState(false)

  // 从服务端加载日志
  useEffect(() => {
    if (!boardId) {
      // 回退到 localStorage（无 boardId 时）
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          setLogs(saved ? JSON.parse(saved) : [])
        } catch {
          setLogs([])
        }
      }
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/boards/${encodeURIComponent(boardId)}/logs`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled && result.success) {
          setLogs(result.data || [])
        }
      })
      .catch((err) => {
        console.error('Failed to load operation logs:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [boardId])

  // 持久化到 localStorage（无 boardId 时）
  useEffect(() => {
    if (!boardId && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)))
    }
  }, [logs, boardId])

  const syncToServer = useCallback(
    async (nextLogs: OperationLogEntry[]) => {
      if (!boardId) return
      try {
        await fetch(`/api/boards/${encodeURIComponent(boardId)}/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextLogs[0]),
        })
      } catch (err) {
        console.error('Failed to sync operation log:', err)
      }
    },
    [boardId]
  )

  const addLog = useCallback(
    (log: OperationLogEntry) => {
      setLogs((prev) => {
        const next = [log, ...prev].slice(0, MAX_LOGS)
        syncToServer(next)
        return next
      })
    },
    [syncToServer]
  )

  const updateLog = useCallback(
    (id: string, updates: Partial<OperationLogEntry>) => {
      setLogs((prev) => {
        const next = prev.map((log) => (log.id === id ? { ...log, ...updates } : log))
        // 同步最新的日志条目（如果状态变为 executed/failed）
        const updatedLog = next.find((l) => l.id === id)
        if (updatedLog && boardId && (updates.status === 'executed' || updates.status === 'failed')) {
          fetch(`/api/boards/${encodeURIComponent(boardId)}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedLog),
          }).catch((err) => console.error('Failed to sync log update:', err))
        }
        return next
      })
    },
    [boardId]
  )

  const clearLogs = useCallback(async () => {
    setLogs([])
    if (boardId) {
      try {
        await fetch(`/api/boards/${encodeURIComponent(boardId)}/logs`, {
          method: 'DELETE',
        })
      } catch (err) {
        console.error('Failed to clear operation logs:', err)
      }
    }
  }, [boardId])

  return {
    logs,
    setLogs,
    loading,
    showLogPanel,
    setShowLogPanel,
    addLog,
    updateLog,
    clearLogs,
  }
}
