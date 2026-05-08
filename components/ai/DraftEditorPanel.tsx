'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { CardDraft } from '@/lib/ai-tools/parser/card-draft-types'
import type { Lane } from '@/lib/db'

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
    <div className="border-t border-border bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-foreground">卡片草稿</div>
          {draftQueue && draftQueue.length > 1 && (
            <div className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-primary">
              {draftIndex + 1}/{draftQueue.length}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {draftQueue && draftQueue.length > 1 && (
            <>
              <Button variant="ghost" size="sm" onClick={onPrev} disabled={draftSubmitting || draftIndex <= 0}>
                上一张
              </Button>
              <Button variant="ghost" size="sm" onClick={onNext} disabled={draftSubmitting || draftIndex >= draftQueue.length - 1}>
                下一张
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} disabled={draftSubmitting}>
            关闭
          </Button>
        </div>
      </div>

      {draftError && <div className="mt-2 text-xs text-destructive">{draftError}</div>}
      {(draftRaw || draftRepairedRaw) && (
        <div className="mt-2 space-y-2">
          {draftRepairedRaw && (
            <details className="rounded-md border bg-muted/40 px-2 py-1">
              <summary className="cursor-pointer text-xs text-muted-foreground">查看二次格式化输出</summary>
              <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-2 text-[11px] leading-relaxed">
                {draftRepairedRaw}
              </pre>
              <div className="mt-2 flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={() => onCopyToClipboard(draftRepairedRaw)}>
                  复制
                </Button>
              </div>
            </details>
          )}
          {draftRaw && (
            <details className="rounded-md border bg-muted/40 px-2 py-1">
              <summary className="cursor-pointer text-xs text-muted-foreground">查看原始 AI 输出</summary>
              <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-2 text-[11px] leading-relaxed">
                {draftRaw}
              </pre>
              <div className="mt-2 flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={() => onCopyToClipboard(draftRaw)}>
                  复制
                </Button>
              </div>
            </details>
          )}
        </div>
      )}
      {draft && (
        <div className="mt-2 space-y-2">
          <input
            value={draft.title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            placeholder="卡片标题"
            disabled={draftSubmitting}
          />
          <Textarea
            value={draft.description || ''}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="min-h-[88px] resize-none text-sm"
            placeholder="卡片描述（可选）"
            disabled={draftSubmitting}
          />
          <div className="flex items-center gap-2">
            <select
              value={draft.laneId || defaultLaneId}
              onChange={(e) => onLaneIdChange(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
              disabled={draftSubmitting}
            >
              {lanes.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.title}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={() => void onCreateCurrent()} disabled={!draft.title.trim() || draftSubmitting}>
              {draftSubmitting ? '创建中...' : '创建'}
            </Button>
            {draftQueue && draftQueue.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => void onCreateAll()} disabled={draftSubmitting}>
                全部创建
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
