'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Eye, EyeOff, Upload, X, User, Bot } from 'lucide-react'
import { Dialog, DialogContent, DialogBody, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { TagSettingsPanel } from './TagSettingsPanel'
import { IconSettingsPanel } from './IconSettingsPanel'
import type { AiSettings, AiModel, AiTrustMode } from '@/types/settings.types'
import type { AiCommand, AiCommandScope, AiCommandPlacement } from '@/types/ai-commands.types'
import {
  createDefaultAiCommands,
  exportAiCommandsToJsonText,
  exportAiCommandsToMarkdownText,
  normalizeAiCommands,
  parseAiCommandsFromText,
} from '@/lib/ai/commands'
import { toastError, toastSuccess, toastWarning } from '@/components/ui/toast'
import { useIconSettings } from '@/lib/hooks/useSettings'

interface AiSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  aiSettings: AiSettings | null
  onAiSettingsChange: (settings: Partial<AiSettings>) => Promise<void>
  loading?: boolean
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function AiSettingsDialog({
  open,
  onOpenChange,
  aiSettings,
  onAiSettingsChange,
  loading,
}: AiSettingsDialogProps) {
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general' | 'trigger' | 'tags' | 'icons' | 'appearance'>('general')
  const [themeDraft, setThemeDraft] = useState<'claude' | 'notion'>('claude')
  const [themeLoading, setThemeLoading] = useState(false)
  const { userAvatar, aiAvatar, uploadIcon, updateAvatar, fetchIconSettings } = useIconSettings()
  const [avatarUploading, setAvatarUploading] = useState<'user' | 'ai' | null>(null)
  const userFileInputRef = useRef<HTMLInputElement | null>(null)
  const aiFileInputRef = useRef<HTMLInputElement | null>(null)
  const [settingsDraft, setSettingsDraft] = useState(aiSettings?.toolTrigger ?? null)
  const [trustModeDraft, setTrustModeDraft] = useState<AiTrustMode>(aiSettings?.trustMode ?? 'confirm_high_risk')
  const [autoMinimizeDraft, setAutoMinimizeDraft] = useState(aiSettings?.autoMinimizeAfterAction ?? true)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [apiKeyDirty, setApiKeyDirty] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [modelDraft, setModelDraft] = useState<AiModel>(aiSettings?.defaultModel ?? 'deepseek-v4-flash')

  // 当外部设置变化时同步模型草稿（用户未手动修改时）
  useEffect(() => {
    if (aiSettings?.defaultModel) {
      setModelDraft(aiSettings.defaultModel)
    }
  }, [aiSettings?.defaultModel])
  const [commandsDraft, setCommandsDraft] = useState<AiCommand[] | null>(() => {
    const commands = aiSettings?.commands && aiSettings.commands.length > 0
      ? aiSettings.commands
      : createDefaultAiCommands()
    return commands
  })
  const commandImportInputRef = useRef<HTMLInputElement | null>(null)

  const downloadTextFile = useCallback((filename: string, text: string, mimeType: string) => {
    const blob = new Blob([text], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [])

  const updateCommandDraft = useCallback((index: number, patch: Partial<AiCommand>) => {
    setCommandsDraft((prev) => {
      if (!prev) return prev
      return prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    })
  }, [])

  const removeCommandDraft = useCallback((index: number) => {
    setCommandsDraft((prev) => {
      if (!prev) return prev
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const addCommandDraft = useCallback(() => {
    setCommandsDraft((prev) => {
      const next = Array.isArray(prev) ? [...prev] : []
      const id = createId()
      next.push({
        id,
        trigger: '/cmd',
        kind: 'snippet',
        label: '/cmd',
        description: '',
        insertText: '',
        enabled: true,
        placement: 'slash',
      })
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!settingsDraft || !commandsDraft) return
    const normalized = normalizeAiCommands(commandsDraft)
    if (normalized.length !== commandsDraft.length) {
      toastWarning('部分 command 被忽略：可能是重复触发词或缺少必要字段')
    }
    const updates: Partial<AiSettings> = {
      commands: normalized,
      toolTrigger: settingsDraft,
      trustMode: trustModeDraft,
      autoMinimizeAfterAction: autoMinimizeDraft,
      defaultModel: modelDraft,
    }
    if (apiKeyDirty) {
      updates.apiKey = apiKeyDraft.trim() || undefined
    }
    await onAiSettingsChange(updates)
    onOpenChange(false)
    toastSuccess('已保存设置')
  }, [settingsDraft, commandsDraft, onAiSettingsChange, onOpenChange, apiKeyDraft, apiKeyDirty, modelDraft, trustModeDraft, autoMinimizeDraft])

  // 读取当前外观主题
  useEffect(() => {
    if (!open) return
    fetch('/api/settings/appearance')
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data?.theme) {
          setThemeDraft(result.data.theme)
        }
      })
      .catch(() => {})
  }, [open])

  // 切换主题
  const handleThemeChange = useCallback(async (theme: 'claude' | 'notion') => {
    setThemeLoading(true)
    try {
      const response = await fetch('/api/settings/appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新失败')
      }
      // 同步通知 ThemeProvider
      localStorage.setItem('kanban-theme', theme)
      const setThemeFn = (window as unknown as Record<string, unknown>).__setKanbanTheme as ((t: string) => void) | undefined
      if (typeof setThemeFn === 'function') {
        setThemeFn(theme)
      }
      toastSuccess(theme === 'notion' ? '已切换到 Notion 风格' : '已切换到 Claude 风格')
    } catch {
      toastError('切换风格失败')
    } finally {
      setThemeLoading(false)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI 助手设置</DialogTitle>
        </DialogHeader>

        {/* Tab 导航 */}
        <div className="flex border-b">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              settingsActiveTab === 'general'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSettingsActiveTab('general')}
          >
            通用设置
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              settingsActiveTab === 'trigger'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSettingsActiveTab('trigger')}
          >
            触发设置
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              settingsActiveTab === 'tags'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSettingsActiveTab('tags')}
          >
            标签管理
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              settingsActiveTab === 'icons'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSettingsActiveTab('icons')}
          >
            图标管理
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              settingsActiveTab === 'appearance'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setSettingsActiveTab('appearance')}
          >
            外观
          </button>
        </div>

        {settingsActiveTab === 'general' && (
          <DialogBody className="space-y-4">
            <div className="space-y-3 rounded-md border p-3">
              <div className="text-sm font-medium">DeepSeek 配置</div>
              <div className="space-y-2">
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">API Key</label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      name="deepseek-api-key"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder={aiSettings?.apiKey ? '已保存 API Key；输入新 key 才会替换' : 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                      value={apiKeyDraft}
                      onChange={(e) => {
                        setApiKeyDraft(e.target.value)
                        setApiKeyDirty(true)
                      }}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={showApiKey ? '隐藏' : '显示'}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    留空则使用服务器环境变量中的 DEEPSEEK_API_KEY
                  </p>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">默认模型</label>
                  <select
                    value={modelDraft}
                    onChange={(e) => setModelDraft(e.target.value as AiModel)}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
                    <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1 rounded-md border p-3">
              <div className="text-sm font-medium">AI 操作信任模式</div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="trustMode"
                    className="mt-0.5 h-4 w-4"
                    value="confirm_all"
                    checked={trustModeDraft === 'confirm_all'}
                    onChange={(e) => setTrustModeDraft(e.target.value as AiTrustMode)}
                  />
                  <div>
                    <div className="font-medium">全部确认</div>
                    <div className="text-xs text-muted-foreground">每个 AI 操作都需要手动确认</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="trustMode"
                    className="mt-0.5 h-4 w-4"
                    value="confirm_high_risk"
                    checked={trustModeDraft === 'confirm_high_risk'}
                    onChange={(e) => setTrustModeDraft(e.target.value as AiTrustMode)}
                  />
                  <div>
                    <div className="font-medium">仅确认高风险（推荐）</div>
                    <div className="text-xs text-muted-foreground">创建、移动等低风险操作自动执行，删除等高风险操作需要确认</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="trustMode"
                    className="mt-0.5 h-4 w-4"
                    value="auto_execute"
                    checked={trustModeDraft === 'auto_execute'}
                    onChange={(e) => setTrustModeDraft(e.target.value as AiTrustMode)}
                  />
                  <div>
                    <div className="font-medium">自动执行（谨慎）</div>
                    <div className="text-xs text-muted-foreground">几乎所有操作都自动执行，仅删除操作仍需确认</div>
                  </div>
                </label>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={autoMinimizeDraft}
                onChange={(e) => setAutoMinimizeDraft(e.target.checked)}
              />
              AI 操作完成后自动最小化面板
            </label>
          </DialogBody>
        )}

        {settingsActiveTab === 'trigger' && settingsDraft && commandsDraft && (
          <DialogBody className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={settingsDraft.gateByPrefix}
                onChange={(e) =>
                  setSettingsDraft((prev) => (prev ? { ...prev, gateByPrefix: e.target.checked } : prev))
                }
              />
              仅当消息以触发前缀开头时才启用工具
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={settingsDraft.showQuickTemplatesInChat}
                onChange={(e) =>
                  setSettingsDraft((prev) => (prev ? { ...prev, showQuickTemplatesInChat: e.target.checked } : prev))
                }
              />
              普通聊天中显示快捷模板按钮
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={settingsDraft.showAssistantActionsInChat}
                onChange={(e) =>
                  setSettingsDraft((prev) =>
                    prev ? { ...prev, showAssistantActionsInChat: e.target.checked } : prev
                  )
                }
              />
              普通聊天中显示&quot;创建为卡片/编辑后创建&quot;
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={autoMinimizeDraft}
                onChange={(e) => setAutoMinimizeDraft(e.target.checked)}
              />
              AI 操作完成后自动最小化面板
            </label>

            <div className="space-y-1 rounded-md border p-3">
              <div className="text-sm font-medium">AI 操作信任模式</div>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="trustMode"
                    className="mt-0.5 h-4 w-4"
                    value="confirm_all"
                    checked={trustModeDraft === 'confirm_all'}
                    onChange={(e) => setTrustModeDraft(e.target.value as AiTrustMode)}
                  />
                  <div>
                    <div className="font-medium">全部确认</div>
                    <div className="text-xs text-muted-foreground">每个 AI 操作都需要手动确认</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="trustMode"
                    className="mt-0.5 h-4 w-4"
                    value="confirm_high_risk"
                    checked={trustModeDraft === 'confirm_high_risk'}
                    onChange={(e) => setTrustModeDraft(e.target.value as AiTrustMode)}
                  />
                  <div>
                    <div className="font-medium">仅确认高风险（推荐）</div>
                    <div className="text-xs text-muted-foreground">创建、移动等低风险操作自动执行，删除等高风险操作需要确认</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="trustMode"
                    className="mt-0.5 h-4 w-4"
                    value="auto_execute"
                    checked={trustModeDraft === 'auto_execute'}
                    onChange={(e) => setTrustModeDraft(e.target.value as AiTrustMode)}
                  />
                  <div>
                    <div className="font-medium">自动执行（谨慎）</div>
                    <div className="text-xs text-muted-foreground">几乎所有操作都自动执行，仅删除操作仍需确认</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium">Commands</div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTextFile('ai-commands.json', exportAiCommandsToJsonText(commandsDraft), 'application/json')}
                  >
                    导出 JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTextFile('ai-commands.md', exportAiCommandsToMarkdownText(commandsDraft), 'text/markdown')}
                  >
                    导出 MD
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => commandImportInputRef.current?.click()}
                  >
                    导入
                  </Button>
                  <Button variant="outline" size="sm" onClick={addCommandDraft}>
                    新增
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCommandsDraft(createDefaultAiCommands())}>
                    重置
                  </Button>
                  <input
                    ref={commandImportInputRef}
                    type="file"
                    accept=".json,.md,.txt,application/json,text/markdown,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      void (async () => {
                        const text = await file.text()
                        const parsed = parseAiCommandsFromText(text)
                        if (!parsed || parsed.length === 0) {
                          toastError('导入失败：未识别到 commands')
                        } else {
                          setCommandsDraft(parsed)
                          toastSuccess(`已导入 ${parsed.length} 条 command`)
                        }
                        e.target.value = ''
                      })()
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-2">
                {commandsDraft.map((c, idx) => (
                  <div key={c.id} className="space-y-2 rounded-md border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={c.enabled}
                          onChange={(e) => updateCommandDraft(idx, { enabled: e.target.checked })}
                        />
                        启用
                      </label>
                      <div className="min-w-0 flex-1">
                        <Input
                          value={c.trigger}
                          onChange={(e) => updateCommandDraft(idx, { trigger: e.target.value })}
                          placeholder="/card"
                        />
                      </div>
                      <select
                        value={c.kind}
                        onChange={(e) => {
                          const kind = e.target.value as AiCommand['kind']
                          updateCommandDraft(idx, {
                            kind,
                            scope: kind === 'tool_prefix' ? (c.scope || 'all') : undefined,
                            placement: kind === 'tool_prefix' ? 'slash' : c.placement,
                          })
                        }}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="tool_prefix">tool</option>
                        <option value="snippet">snippet</option>
                      </select>
                      {c.kind === 'tool_prefix' && (
                        <select
                          value={c.scope || 'all'}
                          onChange={(e) => updateCommandDraft(idx, { scope: e.target.value as AiCommandScope })}
                          className="h-9 rounded-md border bg-background px-2 text-sm"
                        >
                          <option value="all">all</option>
                          <option value="card">card</option>
                          <option value="lane">lane</option>
                          <option value="board">board</option>
                        </select>
                      )}
                      <select
                        value={c.placement}
                        onChange={(e) => updateCommandDraft(idx, { placement: e.target.value as AiCommandPlacement })}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="slash">slash</option>
                        <option value="quickbar">quickbar</option>
                        <option value="both">both</option>
                      </select>
                      <Button variant="outline" size="sm" onClick={() => removeCommandDraft(idx)}>
                        删除
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="grid gap-1">
                        <div className="text-xs text-muted-foreground">菜单标题</div>
                        <Input value={c.label} onChange={(e) => updateCommandDraft(idx, { label: e.target.value })} />
                      </div>
                      <div className="grid gap-1">
                        <div className="text-xs text-muted-foreground">描述（可选）</div>
                        <Input
                          value={c.description || ''}
                          onChange={(e) => updateCommandDraft(idx, { description: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid gap-1">
                      <div className="text-xs text-muted-foreground">插入内容</div>
                      <Textarea
                        value={c.insertText}
                        onChange={(e) => updateCommandDraft(idx, { insertText: e.target.value })}
                        className="min-h-[64px] resize-none text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </DialogBody>
        )}

        {settingsActiveTab === 'tags' && (
          <DialogBody>
            <TagSettingsPanel />
          </DialogBody>
        )}

        {settingsActiveTab === 'icons' && (
          <DialogBody>
            <IconSettingsPanel />
          </DialogBody>
        )}

        {settingsActiveTab === 'appearance' && (
          <DialogBody className="space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-medium">界面风格</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setThemeDraft('claude')
                    handleThemeChange('claude')
                  }}
                  className={`relative flex flex-col items-center gap-2 rounded-lg border p-4 transition-all ${
                    themeDraft === 'claude'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
                    <span className="text-xs font-bold text-white">C</span>
                  </div>
                  <div className="text-sm font-medium">Claude 风格</div>
                  <div className="text-xs text-muted-foreground">暖白底 + 橙色品牌色</div>
                  {themeDraft === 'claude' && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setThemeDraft('notion')
                    handleThemeChange('notion')
                  }}
                  className={`relative flex flex-col items-center gap-2 rounded-lg border p-4 transition-all ${
                    themeDraft === 'notion'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2f2f2f]">
                    <span className="text-xs font-bold text-white">N</span>
                  </div>
                  <div className="text-sm font-medium">Notion 风格</div>
                  <div className="text-xs text-muted-foreground">黑白灰 + 米白底</div>
                  {themeDraft === 'notion' && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              </div>
            </div>

            {/* A/B 角色头像上传 */}
            <div className="space-y-3">
              <div className="text-sm font-medium">角色头像</div>
              <div className="grid grid-cols-2 gap-3">
                {/* A 角色 - 用户 */}
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    A 角色（用户）
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      {userAvatar ? (
                        <img src={userAvatar} alt="用户头像" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <input
                        ref={userFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setAvatarUploading('user')
                          try {
                            const result = await uploadIcon(file)
                            await updateAvatar('user', result.url)
                            toastSuccess('用户头像已更新')
                          } catch {
                            toastError('上传失败')
                          } finally {
                            setAvatarUploading(null)
                            if (userFileInputRef.current) userFileInputRef.current.value = ''
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => userFileInputRef.current?.click()}
                        disabled={avatarUploading === 'user'}
                      >
                        <Upload className="mr-1 h-3 w-3" />
                        {avatarUploading === 'user' ? '上传中...' : '上传'}
                      </Button>
                      {userAvatar && (
                        <button
                          className="text-left text-[11px] text-destructive hover:underline"
                          onClick={async () => {
                            await updateAvatar('user', undefined)
                            toastSuccess('已恢复默认')
                          }}
                        >
                          恢复默认
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* B 角色 - AI */}
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />
                    B 角色（AI 助手）
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      {aiAvatar ? (
                        <img src={aiAvatar} alt="AI头像" className="h-full w-full object-cover" />
                      ) : (
                        <Bot className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <input
                        ref={aiFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setAvatarUploading('ai')
                          try {
                            const result = await uploadIcon(file)
                            await updateAvatar('ai', result.url)
                            toastSuccess('AI 头像已更新')
                          } catch {
                            toastError('上传失败')
                          } finally {
                            setAvatarUploading(null)
                            if (aiFileInputRef.current) aiFileInputRef.current.value = ''
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => aiFileInputRef.current?.click()}
                        disabled={avatarUploading === 'ai'}
                      >
                        <Upload className="mr-1 h-3 w-3" />
                        {avatarUploading === 'ai' ? '上传中...' : '上传'}
                      </Button>
                      {aiAvatar && (
                        <button
                          className="text-left text-[11px] text-destructive hover:underline"
                          onClick={async () => {
                            await updateAvatar('ai', undefined)
                            toastSuccess('已恢复默认')
                          }}
                        >
                          恢复默认
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A 角色头像会显示在左上角 Logo 和用户提问气泡旁；B 角色头像会显示在 AI 助手顶部和回复气泡旁。未上传时默认使用 Logo。
              </p>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="text-xs font-medium text-muted-foreground">当前风格特点</div>
              {themeDraft === 'claude' ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• 暖白色背景，低饱和度配色</li>
                  <li>• 橙色品牌色主按钮</li>
                  <li>• 圆角 12px，轻微阴影</li>
                  <li>• 卡片列表支持网格线背景</li>
                </ul>
              ) : (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• 纯白主区域 + 米白侧边栏</li>
                  <li>• 黑色主按钮，白字</li>
                  <li>• 圆角 6px，无阴影，细边框</li>
                  <li>• 极简黑白灰配色</li>
                </ul>
              )}
            </div>
          </DialogBody>
        )}

        {(settingsActiveTab === 'general' || settingsActiveTab === 'trigger' || settingsActiveTab === 'icons') && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
