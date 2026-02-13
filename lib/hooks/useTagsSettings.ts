/**
 * 标签设置管理 Hook
 * 用于前端获取和更新全局标签配置
 */

import { useCallback, useEffect, useState } from 'react'
import type { TagsSettings } from '@/types/settings.types'
import type { Tag } from '@/types/card.types'

/**
 * API 响应类型
 */
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 使用标签设置的 Hook
 */
export function useTagsSettings() {
  const [settings, setSettings] = useState<TagsSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取标签设置
   */
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/tags')
      const result: ApiResponse<TagsSettings> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取标签设置失败')
      }
      
      setSettings(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取标签设置失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新标签设置
   */
  const updateSettings = useCallback(async (updates: Partial<TagsSettings>) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      
      const result: ApiResponse<TagsSettings> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新标签设置失败')
      }
      
      setSettings(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新标签设置失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 添加标签
   */
  const addTag = useCallback(async (name: string, color: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/tags/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      })
      
      const result: ApiResponse<Tag[]> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '添加标签失败')
      }
      
      setSettings(prev => prev ? { ...prev, globalTags: result.data! } : null)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '添加标签失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新标签
   */
  const updateTag = useCallback(async (tagId: string, updates: Partial<Tag>) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/settings/tags/items/${tagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      
      const result: ApiResponse<Tag[]> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新标签失败')
      }
      
      setSettings(prev => prev ? { ...prev, globalTags: result.data! } : null)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新标签失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 删除标签
   */
  const removeTag = useCallback(async (tagId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/settings/tags/items/${tagId}`, {
        method: 'DELETE',
      })
      
      const result: ApiResponse<Tag[]> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除标签失败')
      }
      
      setSettings(prev => prev ? { ...prev, globalTags: result.data! } : null)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除标签失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 重新排序标签
   */
  const reorderTags = useCallback(async (newOrder: Tag[]) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/tags/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      })
      
      const result: ApiResponse<Tag[]> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '重新排序标签失败')
      }
      
      setSettings(prev => prev ? { ...prev, globalTags: result.data! } : null)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '重新排序标签失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    fetchSettings().catch(() => {
      // 错误已在 fetchSettings 中处理
    })
  }, [fetchSettings])

  return {
    settings,
    tags: settings?.globalTags || [],
    colorOptions: settings?.colorOptions || [],
    allowCustomTags: settings?.allowCustomTags ?? true,
    loading,
    error,
    fetchSettings,
    updateSettings,
    addTag,
    updateTag,
    removeTag,
    reorderTags,
  }
}
