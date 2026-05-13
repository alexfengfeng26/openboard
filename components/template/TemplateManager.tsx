'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TemplateCard } from './TemplateCard'
import { TemplateEditor } from './TemplateEditor'
import { useTemplates, useTemplateActions } from '@/lib/hooks/useTemplates'
import type { Template, TemplateType, TemplateDraft } from '@/types/template.types'
import { toastSuccess, toastError } from '@/components/ui/toast'
import {
  Layout,
  FileText,
  Bug,
  Zap,
  Bot,
  Search,
  Plus,
  Upload,
  Download,
  X,
} from 'lucide-react'

const TYPE_ITEMS: { type: TemplateType; label: string; icon: React.ReactNode }[] = [
  { type: 'board', label: '看板', icon: <Layout className="h-4 w-4" /> },
  { type: 'card', label: '卡片', icon: <FileText className="h-4 w-4" /> },
  { type: 'lane', label: '列表', icon: <Bug className="h-4 w-4" /> },
  { type: 'automation', label: '规则', icon: <Zap className="h-4 w-4" /> },
  { type: 'prompt', label: '提示词', icon: <Bot className="h-4 w-4" /> },
]

interface TemplateManagerProps {
  onUseTemplate?: (template: Template) => void
}

export function TemplateManager({ onUseTemplate }: TemplateManagerProps) {
  const [activeType, setActiveType] = useState<TemplateType | undefined>('board')
  const [search, setSearch] = useState('')
  const { templates, loading, fetchTemplates } = useTemplates({ type: activeType })
  const {
    createTemplate,
    updateTemplate,
    deleteTemplate,
    cloneTemplate,
    exportTemplates,
    importTemplates,
  } = useTemplateActions()

  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

  const filtered = templates.filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      t.meta.name.toLowerCase().includes(q) ||
      t.meta.description?.toLowerCase().includes(q) ||
      t.meta.tags?.some((tag) => tag.toLowerCase().includes(q))
    )
  })

  const handleCreate = () => {
    setEditingTemplate(null)
    setShowEditor(true)
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setShowEditor(true)
  }

  const handleSave = async (draft: TemplateDraft) => {
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.meta.id, draft)
        toastSuccess('模板已保存')
      } else {
        await createTemplate(draft)
        toastSuccess('模板创建成功')
      }
      setShowEditor(false)
      fetchTemplates()
    } catch {
      toastError('保存失败')
    }
  }

  const handleDelete = async (template: Template) => {
    if (!confirm(`确定要删除模板 "${template.meta.name}" 吗？`)) return
    try {
      await deleteTemplate(template.meta.id)
      toastSuccess('模板已删除')
      fetchTemplates()
    } catch {
      toastError('删除失败')
    }
  }

  const handleClone = async (template: Template) => {
    try {
      await cloneTemplate(template.meta.id)
      toastSuccess('模板已复制')
      fetchTemplates()
    } catch {
      toastError('复制失败')
    }
  }

  const handleExport = async () => {
    try {
      const ids = filtered.map((t) => t.meta.id)
      if (ids.length === 0) {
        toastError('没有可导出的模板')
        return
      }
      const bundle = await exportTemplates(ids)
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `templates-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toastSuccess('导出成功')
    } catch {
      toastError('导出失败')
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const bundle = JSON.parse(text)
        const result = await importTemplates(bundle)
        toastSuccess(`导入完成：${result.imported} 个成功`)
        fetchTemplates()
      } catch {
        toastError('导入失败，请检查文件格式')
      }
    }
    input.click()
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-44 shrink-0 border-r border-border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">模板类型</div>
        <div className="space-y-0.5">
          <button
            onClick={() => setActiveType(undefined)}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
              !activeType ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
            }`}
          >
            <Layout className="h-4 w-4" />
            全部
          </button>
          {TYPE_ITEMS.map((item) => (
            <button
              key={item.type}
              onClick={() => setActiveType(item.type)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                activeType === item.type ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">模板库</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索模板..."
                className="h-8 w-56 pl-9 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleImport}>
              <Upload className="h-3.5 w-3.5" />
              导入
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              导出
            </Button>
            <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleCreate}>
              <Plus className="h-3.5 w-3.5" />
              新建模板
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? '未找到匹配的模板' : '暂无模板，点击右上角创建'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((template) => (
              <TemplateCard
                key={template.meta.id}
                template={template}
                onSelect={onUseTemplate}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClone={handleClone}
              />
            ))}
          </div>
        )}
      </div>

      <TemplateEditor
        key={editingTemplate ? editingTemplate.meta.id : `new-${activeType || 'board'}`}
        open={showEditor}
        template={editingTemplate}
        defaultType={activeType || 'board'}
        onSave={handleSave}
        onCancel={() => setShowEditor(false)}
      />
    </div>
  )
}
