/**
 * 设置管理 Hook
 * 用于前端获取和更新应用设置
 */

import { useCallback, useEffect, useState } from 'react'
import type { 
  AppSettings, 
  AiSettings, 
  BoardViewSettings, 
  AiToolTriggerConfig 
} from '@/types/settings.types'
import type { AiCommand } from '@/types/ai-commands.types'

/**
 * API 响应类型
 */
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 使用设置的 Hook
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取完整设置
   */
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings')
      const result: ApiResponse<AppSettings> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取设置失败')
      }
      
      setSettings(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取设置失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新设置
   */
  const updateSettings = useCallback(async (
    updates: { ai?: Partial<AiSettings>; boardView?: Partial<BoardViewSettings> }
  ) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      
      const result: ApiResponse<AppSettings> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新设置失败')
      }
      
      setSettings(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新设置失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 重置为默认设置
   */
  const resetSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings', {
        method: 'DELETE',
      })
      
      const result: ApiResponse<AppSettings> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '重置设置失败')
      }
      
      setSettings(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '重置设置失败'
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
    loading,
    error,
    fetchSettings,
    updateSettings,
    resetSettings,
  }
}

/**
 * 使用 AI 设置的 Hook
 */
export function useAiSettings() {
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取 AI 设置
   */
  const fetchAiSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/ai')
      const result: ApiResponse<AiSettings> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取 AI 设置失败')
      }
      
      setAiSettings(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取 AI 设置失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新 AI 设置
   */
  const updateAiSettings = useCallback(async (updates: Partial<AiSettings>) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      
      const result: ApiResponse<AiSettings> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新 AI 设置失败')
      }
      
      setAiSettings(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新 AI 设置失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    fetchAiSettings().catch(() => {
      // 错误已在 fetchAiSettings 中处理
    })
  }, [fetchAiSettings])

  return {
    aiSettings,
    loading,
    error,
    fetchAiSettings,
    updateAiSettings,
  }
}

/**
 * 使用 AI 命令的 Hook
 */
export function useAiCommands() {
  const [commands, setCommands] = useState<AiCommand[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取 AI 命令
   */
  const fetchCommands = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/ai/commands')
      const result: ApiResponse<AiCommand[]> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取 AI 命令失败')
      }
      
      setCommands(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取 AI 命令失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新 AI 命令
   */
  const updateCommands = useCallback(async (newCommands: AiCommand[]) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/ai/commands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands: newCommands }),
      })
      
      const result: ApiResponse<AiCommand[]> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新 AI 命令失败')
      }
      
      setCommands(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新 AI 命令失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    fetchCommands().catch(() => {
      // 错误已在 fetchCommands 中处理
    })
  }, [fetchCommands])

  return {
    commands,
    loading,
    error,
    fetchCommands,
    updateCommands,
  }
}

/**
 * 使用工具触发配置的 Hook
 */
export function useToolTriggerConfig() {
  const [config, setConfig] = useState<AiToolTriggerConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取工具触发配置
   */
  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/ai/tool-trigger')
      const result: ApiResponse<AiToolTriggerConfig> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取工具触发配置失败')
      }
      
      setConfig(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取工具触发配置失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新工具触发配置
   */
  const updateConfig = useCallback(async (newConfig: AiToolTriggerConfig) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/ai/tool-trigger', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      })
      
      const result: ApiResponse<AiToolTriggerConfig> = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新工具触发配置失败')
      }
      
      setConfig(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新工具触发配置失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    fetchConfig().catch(() => {
      // 错误已在 fetchConfig 中处理
    })
  }, [fetchConfig])

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig,
  }
}
