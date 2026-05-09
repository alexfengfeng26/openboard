/**
 * 设置管理 Hook
 * 用于前端获取和更新应用设置
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { 
  AppSettings, 
  AiSettings, 
  BoardViewSettings, 
  AiToolTriggerConfig,
  IconSettings,
  BoardIcon,
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
 * 泛型 API 资源 Hook
 * 封装通用的 fetch / update / loading / error 逻辑
 */
function useApiResource<T>(
  fetchUrl: string,
  updateUrl?: string,
  options?: {
    method?: 'PUT' | 'POST'
    bodyFormatter?: (data: Partial<T> | T) => unknown
    initialData?: T
  }
) {
  const method = options?.method || 'PUT'
  const bodyFormatterRef = useRef(options?.bodyFormatter)
  bodyFormatterRef.current = options?.bodyFormatter

  const [data, setData] = useState<T | null>(options?.initialData ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(fetchUrl)
      const result: ApiResponse<T> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取失败')
      }
      setData(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchUrl])

  const updateData = useCallback(async (updates: Partial<T> | T) => {
    if (!updateUrl) throw new Error('未配置更新接口')
    setLoading(true)
    setError(null)
    try {
      const body = bodyFormatterRef.current
        ? bodyFormatterRef.current(updates)
        : updates
      const response = await fetch(updateUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result: ApiResponse<T> = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新失败')
      }
      setData(result.data!)
      return result.data!
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新失败'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [updateUrl, method])

  useEffect(() => {
    fetchData().catch(() => {})
  }, [fetchData])

  return { data, setData, loading, setLoading, error, setError, fetchData, updateData }
}

/**
 * 使用设置的 Hook
 */
export function useSettings() {
  const {
    data: settings,
    setData: setSettings,
    loading,
    setLoading,
    error,
    setError,
    fetchData: fetchSettings,
    updateData: _updateSettings,
  } = useApiResource<AppSettings>('/api/settings', '/api/settings')

  const updateSettings = useCallback(async (
    updates: { ai?: Partial<AiSettings>; boardView?: Partial<BoardViewSettings> }
  ) => {
    return _updateSettings(updates as Partial<AppSettings>)
  }, [_updateSettings])

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
  }, [setLoading, setError, setSettings])

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
  const {
    data: aiSettings,
    loading,
    error,
    fetchData: fetchAiSettings,
    updateData: updateAiSettings,
  } = useApiResource<AiSettings>('/api/settings/ai', '/api/settings/ai')

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
  const {
    data: commands,
    loading,
    error,
    fetchData: fetchCommands,
    updateData: _updateCommands,
  } = useApiResource<AiCommand[]>('/api/settings/ai/commands', '/api/settings/ai/commands', {
    bodyFormatter: (commands) => ({ commands }),
    initialData: [],
  })

  const updateCommands = useCallback(async (newCommands: AiCommand[]) => {
    return _updateCommands(newCommands)
  }, [_updateCommands])

  return {
    commands: commands ?? [],
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
  const {
    data: config,
    loading,
    error,
    fetchData: fetchConfig,
    updateData: updateConfig,
  } = useApiResource<AiToolTriggerConfig>('/api/settings/ai/tool-trigger', '/api/settings/ai/tool-trigger')

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig,
  }
}

/**
 * 使用图标设置的 Hook
 */
export function useIconSettings() {
  const {
    data: iconSettings,
    loading,
    error,
    fetchData: fetchIconSettings,
    updateData: _updateIconSettings,
  } = useApiResource<IconSettings>('/api/settings/icons', '/api/settings/icons', {
    initialData: { icons: [] },
  })

  const updateIcons = useCallback(async (icons: BoardIcon[]) => {
    return _updateIconSettings({ icons })
  }, [_updateIconSettings])

  const addIcon = useCallback(async (icon: BoardIcon) => {
    const current = iconSettings ?? { icons: [] }
    return _updateIconSettings({ icons: [...current.icons, icon] })
  }, [_updateIconSettings, iconSettings])

  const removeIcon = useCallback(async (iconId: string) => {
    const current = iconSettings ?? { icons: [] }
    return _updateIconSettings({ icons: current.icons.filter((i) => i.id !== iconId) })
  }, [_updateIconSettings, iconSettings])

  const scanIcons = useCallback(async () => {
    const response = await fetch('/api/settings/icons/scan')
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || '扫描失败')
    }
    return result.data?.newIcons as BoardIcon[] || []
  }, [])

  const uploadIcon = useCallback(async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/settings/icons/upload', {
      method: 'POST',
      body: formData,
    })
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || '上传失败')
    }
    return result.data as BoardIcon
  }, [])

  const deleteIcon = useCallback(async (iconId: string) => {
    const response = await fetch(`/api/settings/icons/${encodeURIComponent(iconId)}`, {
      method: 'DELETE',
    })
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || '删除失败')
    }
    // 同步本地状态
    const current = iconSettings ?? { icons: [] }
    await _updateIconSettings({ icons: current.icons.filter((i) => i.id !== iconId) })
  }, [iconSettings, _updateIconSettings])

  return {
    iconSettings: iconSettings ?? { icons: [] },
    icons: iconSettings?.icons ?? [],
    loading,
    error,
    fetchIconSettings,
    updateIcons,
    addIcon,
    removeIcon,
    scanIcons,
    uploadIcon,
    deleteIcon,
  }
}
