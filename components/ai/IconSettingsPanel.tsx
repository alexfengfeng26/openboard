'use client'

import { useState, useRef, useCallback } from 'react'
import { useIconSettings } from '@/lib/hooks/useSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toastSuccess, toastError, toastInfo } from '@/components/ui/toast'
import { Trash2, FolderSearch, Upload, Image } from 'lucide-react'

export function IconSettingsPanel() {
  const {
    icons,
    loading,
    scanIcons,
    uploadIcon,
    deleteIcon,
    updateIcons,
  } = useIconSettings()

  const [scanning, setScanning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredIcons = icons.filter((icon) =>
    icon.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleScan = useCallback(async () => {
    setScanning(true)
    try {
      const newIcons = await scanIcons()
      if (newIcons.length === 0) {
        toastInfo('未发现新图标')
        return
      }
      const merged = [...icons, ...newIcons]
      await updateIcons(merged)
      toastSuccess(`已发现 ${newIcons.length} 个新图标`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : '扫描失败')
    } finally {
      setScanning(false)
    }
  }, [scanIcons, icons, updateIcons])

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setUploading(true)
      try {
        for (const file of Array.from(files)) {
          await uploadIcon(file)
        }
        toastSuccess(`已上传 ${files.length} 个图标`)
      } catch (err) {
        toastError(err instanceof Error ? err.message : '上传失败')
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [uploadIcon]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      await handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDelete = useCallback(async (iconId: string) => {
    setDeletingId(iconId)
    try {
      await deleteIcon(iconId)
      toastSuccess('已删除图标')
    } catch (err) {
      toastError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }, [deleteIcon])

  const handleRename = useCallback(
    (iconId: string, newName: string) => {
      const updated = icons.map((i) => (i.id === iconId ? { ...i, name: newName } : i))
      updateIcons(updated).catch(() => {})
    },
    [icons, updateIcons]
  )

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleScan}
          disabled={scanning || loading}
          className="gap-1.5"
        >
          <FolderSearch className="h-3.5 w-3.5" />
          {scanning ? '扫描中...' : '扫描目录'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || loading}
          className="gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? '上传中...' : '上传图标'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp,.gif"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <div className="flex-1" />
        <Input
          type="text"
          placeholder="搜索图标..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-40 text-sm"
        />
      </div>

      {/* 拖拽上传区域 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/30 hover:bg-muted/50'
        }`}
      >
        <Image className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          拖拽图标文件到此处，或点击「上传图标」按钮
        </p>
        <p className="text-xs text-muted-foreground">
          支持 SVG、PNG、JPG、WebP、GIF，最大 2MB
        </p>
      </div>

      {/* 图标网格 */}
      {filteredIcons.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {icons.length === 0
              ? '暂无图标。将图标文件放入 public/icon 目录，或点击上方按钮上传。'
              : '没有匹配的图标'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {filteredIcons.map((icon) => (
            <div
              key={icon.id}
              className="group relative flex flex-col items-center gap-2 rounded-md border p-3 transition-colors hover:border-ring/30 hover:bg-muted/50"
            >
              {/* 删除按钮 */}
              <button
                onClick={() => setConfirmDeleteId(icon.id)}
                disabled={deletingId === icon.id}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                title="删除"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>

              {/* 图标预览 */}
              <div className="flex h-10 w-10 items-center justify-center">
                <img
                  src={icon.url}
                  alt={icon.name}
                  className="max-h-10 max-w-10 object-contain"
                  loading="lazy"
                />
              </div>

              {/* 名称编辑 */}
              <input
                type="text"
                defaultValue={icon.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== icon.name) {
                    handleRename(icon.id, e.target.value.trim())
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                className="w-full bg-transparent text-center text-xs outline-none focus:underline"
                title="点击编辑名称"
              />
            </div>
          ))}
        </div>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="删除图标"
        description="确定要删除这个图标吗？此操作会同时删除文件。已引用该图标的看板可能显示异常。"
        confirmText="删除"
        onConfirm={() => {
          if (confirmDeleteId) void handleDelete(confirmDeleteId)
        }}
      />
    </div>
  )
}
