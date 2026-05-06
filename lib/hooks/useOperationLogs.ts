'use client'

import { useState, useEffect, useCallback } from 'react'
import type { OperationLogEntry } from '@/types/ai-tools.types'

const STORAGE_KEY = 'kanban.operationLogs'
const MAX_LOGS = 100

export function useOperationLogs() {
  const [logs, setLogs] = useState<OperationLogEntry[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [showLogPanel, setShowLogPanel] = useState(false)

  // 持久化到 localStorage，限制最近 100 条（ logs 按时间倒序排列，取前 100 条）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)))
    }
  }, [logs])

  const addLog = useCallback((log: OperationLogEntry) => {
    setLogs((prev) => [log, ...prev].slice(0, MAX_LOGS))
  }, [])

  const updateLog = useCallback((id: string, updates: Partial<OperationLogEntry>) => {
    setLogs((prev) => prev.map((log) => (log.id === id ? { ...log, ...updates } : log)))
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  return {
    logs,
    setLogs,
    showLogPanel,
    setShowLogPanel,
    addLog,
    updateLog,
    clearLogs,
  }
}
