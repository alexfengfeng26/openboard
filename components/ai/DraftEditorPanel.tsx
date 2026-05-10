'use client'

import { ChevronLeft, ChevronRight, X, Copy, FilePlus, FileStack, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { CardDraft } from '@/lib/ai-tools/parser/card-draft-types'
import type { Lane } from '@/lib/db'
import { cn } from '@/lib/utils'

interface DraftEditorPanelProps {
  draft: CardDraft | null
  draftQueue: CardDraft[] | null
  draftIndex: number
  draftError: string | null
  draftRaw: string | null
  draftRepairedRaw: string | null
  draftSubmitting: boolean
  lanes: Lane[]
  defaultLaneId: string
  onTitleChange: (title: string) => void
  onDescriptionChange: (description: string) => void
  onLaneIdChange: (laneId: string) => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onCreateCurrent: () => void
  onCreateAll: () => void
  onCopyToClipboard: (text: string) => void
}

export function DraftEditorPanel({
  draft,
  draftQueue,
  draftIndex,
  draftError,
  draftRaw,
  draftRepairedRaw,
  draftSubmitting,
  lanes,
  defaultLaneId,
  onTitleChange,
  onDescriptionChange,
  onLaneIdChange,
  onPrev,
  onNext,
  onClose,
  onCreateCurrent,
  onCreateAll,
  onCopyToClipboard,
}: DraftEditorPanelProps) {
  if (!draft && !draftError) return null

  return (
    <div className="border-t border-border bg-white">
      <div className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
        <div className="px-3 py-3">
          {/* 标题栏 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">卡片草稿</span>
              {draftQueue && draftQueue.length > 1 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                  {draftIndex + 1} / {draftQueue.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {draftQueue && draftQueue.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={onPrev}
                    disabled={draftSubmitting || draftIndex <= 0}
                    title="上一张"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={onNext}
                    disabled={draftSubmitting || draftIndex >= draftQueue.length - 1}
                    title="下一张"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={onClose}
                disabled={draftSubmitting}
                title="关闭"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 错误信息 */}
          {draftError && (
            <div className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {draftError}
            </div>
          )}

          {/* 原始输出折叠区域 */}
          {(draftRaw || draftRepairedRaw) && (
            <div className="mt-2 space-y-1.5">
              {draftRepairedRaw && (
                <details className="group rounded-lg border border-border bg-muted/30 overflow-hidden">
                  <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors select-none">
                    <FilePlus className="h-3 w-3" />
                    <span>查看二次格式化输出</span>
                    <ChevronRight className="h-3 w-3 ml-auto transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-2.5 pb-2.5">
                    <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-2.5 text-[11px] leading-relaxed border border-border/50">
                      {draftRepairedRaw}
                    </pre>
                    <div className="mt-1.5 flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 text-xs"
                        onClick={() => onCopyToClipboard(draftRepairedRaw)}
                      >
                        <Copy className="h-3 w-3" />
                        复制
                      </Button>
                    </div>
                  </div>
                </details>
              )}
              {draftRaw && (
                <details className="group rounded-lg border border-border bg-muted/30 overflow-hidden">
                  <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors select-none">
                    <FileStack className="h-3 w-3" />
                    <span>查看原始 AI 输出</span>
                    <ChevronRight className="h-3 w-3 ml-auto transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-2.5 pb-2.5">
                    <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-2.5 text-[11px] leading-relaxed border border-border/50">
                      {draftRaw}
                    </pre>
                    <div className="mt-1.5 flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 text-xs"
                        onClick={() => onCopyToClipboard(draftRaw)}
                      >
                        <Copy className="h-3 w-3" />
                        复制
                      </Button>
                    </div>
                  </div>
                </details>
              )}
            </div>
          )}

          {/* 草稿表单 */}
          {draft && (
            <div className="mt-2.5 space-y-2">
              <Input
                value={draft.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="卡片标题"
                disabled={draftSubmitting}
                className="h-9 text-sm border-border/80 focus-visible:ring-primary/20"
              />
              <Textarea
                value={draft.description || ''}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="卡片描述（可选）"
                disabled={draftSubmitting}
                className="min-h-[72px] resize-none text-sm border-border/80 focus-visible:ring-primary/20"
              />
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <select
                    value={draft.laneId || defaultLaneId}
                    onChange={(e) => onLaneIdChange(e.target.value)}
                    disabled={draftSubmitting}
                    className={cn(
                      'h-9 w-full appearance-none rounded-md border border-border/80 bg-background px-3 pr-8 text-sm',
                      'focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10',
                      'disabled:opacity-50'
                    )}
                  >
                    {lanes.map((lane) => (
                      <option key={lane.id} value={lane.id}>
                        {lane.title}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted-foreground" />
                </div>
                <Button
                  size="sm"
                  onClick={() => void onCreateCurrent()}
                  disabled={!draft.title.trim() || draftSubmitting}
                  className="h-9 gap-1 px-3"
                >
                  {draftSubmitting ? (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <FilePlus className="h-3.5 w-3.5" />
                  )}
                  创建
                </Button>
                {draftQueue && draftQueue.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onCreateAll()}
                    disabled={draftSubmitting}
                    className="h-9 gap-1 px-3"
                  >
                    <FileStack className="h-3.5 w-3.5" />
                    全部
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
