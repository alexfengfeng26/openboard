'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Workflow,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Sparkles,
  Wand2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAutomation, type AutomationDryRunResult } from '@/lib/hooks/useAutomation'
import type { AutomationRule, RuleTemplate } from '@/types/automation.types'

interface AutomationPanelProps {
  boardId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AutomationPanel({ boardId, open, onOpenChange }: AutomationPanelProps) {
  const {
    rules,
    templates,
    loading,
    parsing,
    createRule,
    deleteRule,
    toggleRule,
    parseRule,
    dryRunRule,
    createFromTemplate,
  } = useAutomation(boardId)

  const [showCreate, setShowCreate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('')
  const [parsedRule, setParsedRule] = useState<Partial<AutomationRule> | null>(null)
  const [parseExplanation, setParseExplanation] = useState('')
  const [dryRunResult, setDryRunResult] = useState<AutomationDryRunResult | null>(null)
  const [dryRunLoading, setDryRunLoading] = useState(false)
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null)

  const handleParse = async () => {
    if (!naturalLanguageInput.trim()) return
    setDryRunResult(null)
    const result = await parseRule(naturalLanguageInput)
    if (result?.rule) {
      setParsedRule(result.rule)
      setParseExplanation(result.explanation || '')
      setDryRunLoading(true)
      const preview = await dryRunRule(result.rule)
      setDryRunResult(preview)
      setDryRunLoading(false)
    }
  }

  const handleCreateFromParsed = async () => {
    if (!parsedRule) return
    const success = await createRule(parsedRule as Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>)
    if (success) {
      setShowCreate(false)
      setNaturalLanguageInput('')
      setParsedRule(null)
      setParseExplanation('')
      setDryRunResult(null)
    }
  }

  const handleCreateFromTemplate = async (template: RuleTemplate) => {
    const success = await createFromTemplate(template)
    if (success) {
      setShowTemplates(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            自动化规则
            <span className="text-sm font-normal text-muted-foreground">
              ({rules.filter((r) => r.enabled).length}/{rules.length} 启用)
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setShowCreate(!showCreate)
                setShowTemplates(false)
                setParsedRule(null)
                setDryRunResult(null)
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 创建规则
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setShowTemplates(!showTemplates)
                setShowCreate(false)
              }}
            >
              <Wand2 className="h-3.5 w-3.5" />
              预设模板
            </Button>
          </div>

          {/* AI 创建区域 */}
          {showCreate && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <label className="text-sm font-medium">
                用自然语言描述你想要的自动化规则：
              </label>
              <Textarea
                placeholder="例如：当卡片移动到已完成列表时，自动移除进行中标签..."
                value={naturalLanguageInput}
                onChange={(e) => setNaturalLanguageInput(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleParse}
                  disabled={parsing || !naturalLanguageInput.trim()}
                  className="gap-1.5"
                >
                  {parsing ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5 animate-spin" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      解析规则
                    </>
                  )}
                </Button>
              </div>

              {parsedRule && (
                <div className="rounded-md border bg-background p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">解析结果</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">名称：</span>
                      {parsedRule.name}
                    </p>
                    <p>
                      <span className="text-muted-foreground">描述：</span>
                      {parsedRule.description}
                    </p>
                    {parseExplanation && (
                      <p className="text-muted-foreground text-xs">{parseExplanation}</p>
                    )}
                  </div>
                  <div
                    className={cn(
                      'rounded-md border px-2.5 py-2 text-xs',
                      dryRunResult?.executable === false
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-border bg-muted/40 text-muted-foreground'
                    )}
                  >
                    {dryRunLoading ? (
                      '正在预览这条规则会影响哪些卡片...'
                    ) : dryRunResult ? (
                      dryRunResult.executable ? (
                        `预览：当前会命中 ${dryRunResult.matchedCards} 张卡片，创建后将在对应事件发生时自动执行。`
                      ) : (
                        `预览：缺少 ${dryRunResult.missingMappings.join('、')}，这条规则暂不可执行。建议改成“自动匹配标签”或指定真实 ID。`
                      )
                    ) : (
                      '预览：创建前会检查规则是否缺少列表或标签映射。'
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCreateFromParsed}
                    disabled={dryRunLoading || dryRunResult?.executable === false}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    创建此规则
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 预设模板区域 */}
          {showTemplates && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <label className="text-sm font-medium">选择预设模板：</label>
              <div className="grid gap-2">
                {templates.map((template) => (
                  <div
                    key={template.name}
                    className="flex items-center justify-between rounded-md border bg-background p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCreateFromTemplate(template)}
                      className="gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      使用
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 规则列表 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              现有规则 ({rules.length})
            </h3>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                加载中...
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无自动化规则，使用上方按钮创建
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      rule.enabled
                        ? 'bg-background border-border'
                        : 'bg-muted/30 border-muted'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => toggleRule(rule.id)}
                        >
                          {rule.enabled ? (
                            <Power className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-sm font-medium truncate',
                              !rule.enabled && 'text-muted-foreground'
                            )}
                          >
                            {rule.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {rule.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setExpandedRuleId(
                              expandedRuleId === rule.id ? null : rule.id
                            )
                          }
                        >
                          {expandedRuleId === rule.id ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {expandedRuleId === rule.id && (
                      <div className="mt-3 pt-3 border-t text-xs space-y-2">
                        <div>
                          <span className="text-muted-foreground">触发器：</span>
                          <span className="font-mono bg-muted px-1 rounded">
                            {rule.trigger.type}
                          </span>
                        </div>
                        {rule.trigger.conditions.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">条件：</span>
                            <div className="mt-1 space-y-1">
                              {rule.trigger.conditions.map((cond, i) => (
                                <div key={i} className="font-mono bg-muted px-2 py-1 rounded">
                                  {cond.field} {cond.operator} {String(cond.value)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">动作：</span>
                          <div className="mt-1 space-y-1">
                            {rule.actions.map((action, i) => (
                              <div key={i} className="font-mono bg-muted px-2 py-1 rounded">
                                {action.type}
                                {Object.keys(action.params).length > 0 && (
                                  <span className="text-muted-foreground ml-1">
                                    {JSON.stringify(action.params)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
