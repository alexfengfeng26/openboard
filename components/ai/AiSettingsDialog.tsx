'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogBody, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { TagSettingsPanel } from './TagSettingsPanel'
import type { AiSettings, AiTrustMode } from '@/types/settings.types'
import type { AiCommand, AiCommandScope, AiCommandPlacement } from '@/types/ai-commands.types'
import {
  createDefaultAiCommands,
  exportAiCommandsToJsonText,
  exportAiCommandsToMarkdownText,
  normalizeAiCommands,
  parseAiCommandsFromText,
} from '@/lib/ai/commands'
import { toastError, toastSuccess, toastWarning } from '@/components/ui/toast'

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
  const [settingsActiveTab, setSettingsActiveTab] = useState<'trigger' | 'tags'>('trigger')
  const [settingsDraft, setSettingsDraft] = useState(aiSettings?.toolTrigger ?? null)
  const [trustModeDraft, setTrustModeDraft] = useState<AiTrustMode>(aiSettings?.trustMode ?? 'confirm_high_risk')
  const [autoMinimizeDraft, setAutoMinimizeDraft] = useState(aiSettings?.autoMinimizeAfterAction ?? true)
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
    await onAiSettingsChange({ commands: normalized, toolTrigger: settingsDraft, trustMode: trustModeDraft, autoMinimizeAfterAction: autoMinimizeDraft })
    onOpenChange(false)
    toastSuccess('已保存设置')
  }, [settingsDraft, commandsDraft, onAiSettingsChange, onOpenChange])

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
        </div>

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

        {settingsActiveTab === 'trigger' && (
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
