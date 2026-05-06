'use client'

import { Keyboard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'

interface KeyboardHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardHelp({ open, onOpenChange }: KeyboardHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            键盘快捷键
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <ShortcutItem keys="Cmd/Ctrl + K" desc="聚焦搜索栏" />
            <ShortcutItem keys="Cmd/Ctrl + N" desc="聚焦当前第一个列表的快速添加" />
            <ShortcutItem keys="Esc" desc="退出选择模式 / 关闭对话框" />
            <ShortcutItem keys="?" desc="显示快捷键帮助" />
            <ShortcutItem keys="Ctrl/Cmd + 点击" desc="多选卡片" />
            <ShortcutItem keys="Shift + 点击" desc="区间选择" />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function ShortcutItem({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{desc}</span>
      <kbd className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono">{keys}</kbd>
    </div>
  )
}
