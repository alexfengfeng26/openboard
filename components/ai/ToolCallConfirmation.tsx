'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ToolCallRequest } from '@/types/ai-tools.types'

interface ToolCallConfirmationProps {
  open: boolean
  toolCalls: ToolCallRequest[]
  onConfirm: () => void
  onCancel: () => void
  isExecuting?: boolean
}

/**
 * 工具调用确认对话框
 */
export function ToolCallConfirmation({
  open,
  toolCalls,
  onConfirm,
  onCancel,
  isExecuting = false
}: ToolCallConfirmationProps) {
  if (!open) return null

  const getToolDisplayName = (toolName: string): string => {
    const nameMap: Record<string, string> = {
      create_card: '创建卡片',
      update_card: '更新卡片',
      move_card: '移动卡片',
      delete_card: '删除卡片',
      create_lane: '创建列表',
      delete_lane: '删除列表',
      update_lane: '更新列表',
      create_board: '创建看板',
      delete_board: '删除看板',
      update_board: '更新看板',
    }
    return nameMap[toolName] || toolName
  }

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('delete')) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />
    }
    return <CheckCircle2 className="h-4 w-4 text-green-500" />
  }

  const isDangerous = toolCalls.some(t => t.toolName.includes('delete'))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">确认操作</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            AI 请求执行以下 {toolCalls.length} 个操作，是否继续？
          </p>
        </div>

        <div className="mb-6 space-y-3">
          {toolCalls.map((call, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-md border bg-muted/50 p-3"
            >
              {getToolIcon(call.toolName)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {getToolDisplayName(call.toolName)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {index + 1}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Object.entries(call.params)
                    .filter(([k]) => k !== 'boardId') // 隐藏不重要的参数
                    .map(([key, value]) => (
                      <div key={key}>
                        {key}: {String(value)}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isExecuting}
          >
            取消
          </Button>
          <Button
            variant={isDangerous ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isExecuting}
          >
            {isExecuting ? '执行中...' : '确认执行'}
          </Button>
        </div>
      </div>
    </div>
  )
}
