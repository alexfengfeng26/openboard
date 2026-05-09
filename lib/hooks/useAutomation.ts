/**
 * 自动化规则管理 Hook
 */

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import type { AutomationRule, RuleTemplate } from '@/types/automation.types'

export function useAutomation(boardId?: string) {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [templates, setTemplates] = useState<RuleTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)

  // 获取规则列表
  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const url = boardId
        ? `/api/automation/rules?boardId=${boardId}`
        : '/api/automation/rules'
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setRules(data.rules || [])
      } else {
        toast.error(data.error || '获取规则失败')
      }
    } catch {
      toast.error('获取规则失败')
    } finally {
      setLoading(false)
    }
  }, [boardId])

  // 获取模板列表
  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/automation/templates')
      const data = await response.json()
      if (data.success) {
        setTemplates(data.templates || [])
      }
    } catch {
      // 静默失败
    }
  }, [])

  // 创建规则
  const createRule = useCallback(
    async (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const response = await fetch('/api/automation/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rule),
        })
        const data = await response.json()
        if (data.success) {
          setRules((prev) => [...prev, data.rule])
          toast.success('规则创建成功')
          return data.rule
        } else {
          toast.error(data.error || '创建规则失败')
          return null
        }
      } catch {
        toast.error('创建规则失败')
        return null
      }
    },
    []
  )

  // 更新规则
  const updateRule = useCallback(async (id: string, updates: Partial<AutomationRule>) => {
    try {
      const response = await fetch(`/api/automation/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await response.json()
      if (data.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? data.rule : r))
        )
        toast.success('规则更新成功')
        return data.rule
      } else {
        toast.error(data.error || '更新规则失败')
        return null
      }
    } catch {
      toast.error('更新规则失败')
      return null
    }
  }, [])

  // 删除规则
  const deleteRule = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/automation/rules/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        setRules((prev) => prev.filter((r) => r.id !== id))
        toast.success('规则删除成功')
        return true
      } else {
        toast.error(data.error || '删除规则失败')
        return false
      }
    } catch {
      toast.error('删除规则失败')
      return false
    }
  }, [])

  // 切换规则状态
  const toggleRule = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/automation/rules/${id}`, {
        method: 'PATCH',
      })
      const data = await response.json()
      if (data.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? data.rule : r))
        )
        return data.rule
      } else {
        toast.error(data.error || '切换状态失败')
        return null
      }
    } catch {
      toast.error('切换状态失败')
      return null
    }
  }, [])

  // AI 解析规则
  const parseRule = useCallback(
    async (description: string) => {
      setParsing(true)
      try {
        const response = await fetch('/api/automation/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, boardId }),
        })
        const data = await response.json()
        if (data.success) {
          return data as {
            rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>
            matchedTemplate?: string
            explanation?: string
          }
        } else {
          toast.error(data.error || '解析规则失败')
          return null
        }
      } catch {
        toast.error('解析规则失败')
        return null
      } finally {
        setParsing(false)
      }
    },
    [boardId]
  )

  // 从模板创建规则
  const createFromTemplate = useCallback(
    async (template: RuleTemplate) => {
      return createRule({
        name: template.name,
        description: template.description,
        enabled: true,
        trigger: template.trigger,
        actions: template.actions,
        boardId,
      })
    },
    [createRule, boardId]
  )

  useEffect(() => {
    fetchRules()
    fetchTemplates()
  }, [fetchRules, fetchTemplates])

  return {
    rules,
    templates,
    loading,
    parsing,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    parseRule,
    createFromTemplate,
  }
}
