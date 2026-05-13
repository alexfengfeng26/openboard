/**
 * 模板管理 Hook
 */

import { useCallback, useEffect, useState } from 'react'
import type {
  Template,
  TemplateDraft,
  TemplateFilter,
  TemplateVariableContext,
  ExportBundle,
  ImportResult,
} from '@/types/template.types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  templates?: T
  template?: T
  resolved?: T
  bundle?: T
  result?: T
  error?: string
}

export function useTemplates(filter?: TemplateFilter) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 解构 filter 字段，避免对象引用变化导致无限重渲染
  const filterType = filter?.type
  const filterScope = filter?.scope
  const filterBoardId = filter?.boardId
  const filterTag = filter?.tag
  const filterQ = filter?.q

  const fetchTemplates = useCallback(async (overrideFilter?: TemplateFilter) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const f = overrideFilter || { type: filterType, scope: filterScope, boardId: filterBoardId, tag: filterTag, q: filterQ }
      if (f?.type) params.set('type', f.type)
      if (f?.scope) params.set('scope', f.scope)
      if (f?.boardId) params.set('boardId', f.boardId)
      if (f?.tag) params.set('tag', f.tag)
      if (f?.q) params.set('q', f.q)

      const query = params.toString()
      const url = `/api/templates${query ? `?${query}` : ''}`

      const response = await fetch(url, { cache: 'no-store' })
      const result: ApiResponse<Template[]> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取模板失败')
      }
      const data = result.templates || []
      setTemplates(data)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取模板失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [filterType, filterScope, filterBoardId, filterTag, filterQ])

  useEffect(() => {
    fetchTemplates().catch(() => {})
  }, [fetchTemplates])

  return { templates, loading, error, fetchTemplates, setTemplates }
}

export function useTemplateActions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTemplate = useCallback(async (draft: TemplateDraft): Promise<Template> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const result: ApiResponse<Template> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '创建模板失败')
      }
      return result.template!
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建模板失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateTemplate = useCallback(async (id: string, patch: Partial<Omit<Template, 'meta'>> & { meta?: Partial<Omit<Template['meta'], 'id' | 'createdAt' | 'type'>> }): Promise<Template> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const result: ApiResponse<Template> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新模板失败')
      }
      return result.template!
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新模板失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const result: ApiResponse<void> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除模板失败')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除模板失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const applyTemplate = useCallback(async (id: string, context: TemplateVariableContext): Promise<{ text?: string; content?: Template['content'] }> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/templates/${encodeURIComponent(id)}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      })
      const result: ApiResponse<{ text?: string; content?: Template['content'] }> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '应用模板失败')
      }
      return result.resolved!
    } catch (err) {
      const message = err instanceof Error ? err.message : '应用模板失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const cloneTemplate = useCallback(async (id: string, overrides?: Partial<TemplateDraft['meta']>): Promise<Template> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/templates/${encodeURIComponent(id)}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides || {}),
      })
      const result: ApiResponse<Template> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '克隆模板失败')
      }
      return result.template!
    } catch (err) {
      const message = err instanceof Error ? err.message : '克隆模板失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const exportTemplates = useCallback(async (ids: string[]): Promise<ExportBundle> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/templates/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const result: ApiResponse<ExportBundle> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '导出模板失败')
      }
      return result.bundle!
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出模板失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const importTemplates = useCallback(async (bundle: ExportBundle): Promise<ImportResult> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle }),
      })
      const result: ApiResponse<ImportResult> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '导入模板失败')
      }
      return result.result!
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入模板失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
    cloneTemplate,
    exportTemplates,
    importTemplates,
  }
}
