'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  Clock,
  Copy,
  Tag,
  LayoutList,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { AiInsight, InsightSeverity, InsightType } from '@/types/ai-insights.types'
import type { Board, Card, Lane } from '@/lib/db'
import { toastError, toastSuccess } from '@/components/ui/toast'

interface AiInsightsPanelProps {
  board: Board
  onCardClick?: (cardId: string) => void
  onExecuteTool?: (toolName: string, params: Record<string, unknown>) => Promise<void>
}

/**
 * 获取洞察类型图标
 */
function getInsightTypeIcon(type: InsightType) {
  switch (type) {
    case 'stale_cards':
      return <Clock className="h-4 w-4" />
    case 'duplicate_cards':
      return <Copy className="h-4 w-4" />
    case 'lane_overload':
      return <LayoutList className="h-4 w-4" />
    case 'missing_tags':
      return <Tag className="h-4 w-4" />
    case 'unbalanced_work':
      return <AlertTriangle className="h-4 w-4" />
    case 'action_suggested':
      return <Zap className="h-4 w-4" />
    default:
      return <Info className="h-4 w-4" />
  }
}

/**
 * 获取洞察类型标签
 */
function getInsightTypeLabel(type: InsightType): string {
  const labels: Record<InsightType, string> = {
    stale_cards: '停滞卡片',
    duplicate_cards: '重复卡片',
    lane_overload: '列表过载',
    unbalanced_work: '分配不均',
    missing_tags: '缺少标签',
    action_suggested: '建议操作',
  }
  return labels[type] || type
}

/**
 * 获取严重程度样式
 */
function getSeverityStyles(severity: InsightSeverity): {
  icon: React.ReactNode
  badge: 'default' | 'secondary' | 'destructive' | 'outline'
  border: string
  bg: string
} {
  switch (severity) {
    case 'critical':
      return {
        icon: <AlertCircle className="h-4 w-4 text-destructive" />,
        badge: 'destructive',
        border: 'border-destructive/30',
        bg: 'bg-destructive/5',
      }
    case 'warning':
      return {
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        badge: 'outline',
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/5',
      }
    case 'info':
    default:
      return {
        icon: <Info className="h-4 w-4 text-blue-500" />,
        badge: 'secondary',
        border: 'border-blue-500/20',
        bg: 'bg-blue-500/5',
      }
  }
}

/**
 * AI 洞察面板
 * 主动分析看板状态并给出建议
 */
export function AiInsightsPanel({ board, onCardClick, onExecuteTool }: AiInsightsPanelProps) {
  const [insights, setInsights] = useState<AiInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)

  // 客户端加载后读取本地存储的开关状态
  useEffect(() => {
    const saved = localStorage.getItem('kanban.ai-insights.enabled')
    if (saved === 'true') {
      setEnabled(true)
      // 如果用户之前开启过，加载时也自动展开
      setExpanded(true)
    }
  }, [])

  /**
   * 请求 AI 生成洞察
   */
  const fetchInsights = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: board.id,
          boardTitle: board.title,
          lanes: board.lanes.map((lane) => ({
            id: lane.id,
            title: lane.title,
            cards: lane.cards.map((card) => ({
              id: card.id,
              title: card.title,
              description: card.description,
              position: card.position,
              createdAt: card.createdAt,
              updatedAt: card.updatedAt,
              tags: card.tags,
            })),
          })),
          tags: board.tags,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '生成洞察失败')
      }

      setInsights(data.insights || [])
      setLastUpdated(new Date())
      setDismissedIds(new Set())
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成洞察时出错'
      setError(message)
      toastError(message)
    } finally {
      setLoading(false)
    }
  }, [board])

  /**
   * 执行建议的操作
   */
  const handleExecuteAction = useCallback(
    async (insight: AiInsight) => {
      if (!insight.suggestedAction || !onExecuteTool) return

      setExecutingId(insight.id)
      try {
        await onExecuteTool(insight.suggestedAction.toolName, insight.suggestedAction.params)
        toastSuccess(`已执行：${insight.suggestedAction.label}`)
        // 执行成功后刷新洞察
        await fetchInsights()
      } catch (err) {
        toastError('执行操作失败')
      } finally {
        setExecutingId(null)
      }
    },
    [onExecuteTool, fetchInsights]
  )

  /**
   * 忽略单个洞察
   */
  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id))
  }, [])

  /**
   * 组件挂载时自动获取洞察（仅当展开且开启时）
   */
  useEffect(() => {
    if (enabled && expanded) {
      fetchInsights()
    }
  }, [fetchInsights, enabled, expanded])

  const handleToggleEnabled = useCallback((value: boolean) => {
    setEnabled(value)
    localStorage.setItem('kanban.ai-insights.enabled', String(value))
    // 开启时自动展开并立即触发一次洞察
    if (value) {
      setExpanded(true)
      fetchInsights()
    }
  }, [fetchInsights])

  const visibleInsights = insights.filter((i) => !dismissedIds.has(i.id))
  const hasInsights = visibleInsights.length > 0

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      {/* 头部 */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none',
          'hover:bg-accent/50 transition-colors'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* 左侧固定：标题 + 数量 */}
        <div className="flex items-center gap-2 shrink-0">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">AI 洞察</span>
          {hasInsights && (
            <Badge variant="secondary" className="text-xs">
              {visibleInsights.length}
            </Badge>
          )}
          {loading && (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* 中间：折叠时滚动展示洞察标题 */}
        {!expanded && hasInsights && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap">
              {[...visibleInsights, ...visibleInsights].map((insight, idx) => {
                const styles = getSeverityStyles(insight.severity)
                return (
                  <span
                    key={`${insight.id}-${idx}`}
                    className="inline-flex items-center gap-1.5 mx-3 text-xs text-muted-foreground"
                  >
                    <span className="shrink-0">{styles.icon}</span>
                    <span className="truncate">{insight.title}</span>
                    <span className="text-border opacity-50">|</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* 右侧固定：操作按钮 */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <Switch
            checked={enabled}
            onCheckedChange={handleToggleEnabled}
          />
          {lastUpdated && enabled && (
            <span className="text-[10px] text-muted-foreground mr-1 hidden sm:inline">
              {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              if (enabled) fetchInsights()
            }}
            disabled={loading || !enabled}
            title="刷新洞察"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* 内容区域 */}
      {expanded && (
        <div className="border-t border-border">
          {!enabled ? (
            <div className="px-4 py-6 text-center">
              <Lightbulb className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">AI 洞察已关闭</p>
              <p className="text-xs text-muted-foreground mt-1">打开上方开关以启用智能分析</p>
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-center">
              <AlertCircle className="mx-auto h-5 w-5 text-destructive mb-2" />
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={fetchInsights}
                disabled={loading}
              >
                重试
              </Button>
            </div>
          ) : hasInsights ? (
            <div className="divide-y divide-border">
              {visibleInsights.map((insight) => {
                const styles = getSeverityStyles(insight.severity)
                return (
                  <div
                    key={insight.id}
                    className={cn(
                      'group px-4 py-3 transition-colors hover:bg-accent/30',
                      styles.bg
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{styles.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{insight.title}</span>
                          <Badge variant={styles.badge} className="text-[10px] h-4 px-1">
                            {getInsightTypeLabel(insight.type)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {insight.message}
                        </p>

                        {/* 相关卡片链接 */}
                        {insight.relatedCardIds && insight.relatedCardIds.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {insight.relatedCardIds.map((cardId) => {
                              const card = board.lanes
                                .flatMap((l) => l.cards)
                                .find((c) => c.id === cardId)
                              if (!card) return null
                              return (
                                <button
                                  key={cardId}
                                  onClick={() => onCardClick?.(cardId)}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5',
                                    'text-[11px] bg-background border border-border',
                                    'hover:border-ring hover:bg-accent transition-colors'
                                  )}
                                  title="点击查看卡片"
                                >
                                  {getInsightTypeIcon(insight.type)}
                                  <span className="truncate max-w-[120px]">{card.title}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* 建议操作按钮 */}
                        {insight.suggestedAction && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs gap-1"
                              onClick={() => handleExecuteAction(insight)}
                              disabled={executingId === insight.id || !onExecuteTool}
                            >
                              {executingId === insight.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Zap className="h-3 w-3" />
                              )}
                              {insight.suggestedAction.label}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* 忽略按钮 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onClick={() => handleDismiss(insight.id)}
                        title="忽略"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <Info className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">当前看板状态良好，暂无洞察</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
