'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toastSuccess, toastError } from '@/components/ui/toast'
import type { Board } from '@/lib/db'
import { TemplateCard } from '@/components/template/TemplateCard'
import { TemplateManager } from '@/components/template/TemplateManager'
import { useTemplateActions, useTemplates } from '@/lib/hooks/useTemplates'
import type { Template } from '@/types/template.types'
import { LayoutTemplate, PlusCircle, Save, Search, Settings2, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface CreateBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBoardCreated: (board: Board) => void
  sourceBoard?: Board
}

type Step = 'mode' | 'title'
type CreationMode = 'blank' | 'template' | 'save-current'

export function CreateBoardDialog({ open, onOpenChange, onBoardCreated, sourceBoard }: CreateBoardDialogProps) {
  const [step, setStep] = useState<Step>('mode')
  const [creationMode, setCreationMode] = useState<CreationMode>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('默认看板')
  const [selectedTemplateLaneCount, setSelectedTemplateLaneCount] = useState<number>(0)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [includeCardSkeletons, setIncludeCardSkeletons] = useState(false)
  const [title, setTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 12
  const { templates, loading, fetchTemplates } = useTemplates({ type: 'board' })
  const { createTemplate } = useTemplateActions()

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(
      (template) =>
        template.meta.name.toLowerCase().includes(q) ||
        template.meta.description?.toLowerCase().includes(q) ||
        template.meta.tags?.some((tag) => tag.toLowerCase().includes(q))
    )
  }, [templates, templateSearch])

  const totalPages = Math.ceil(filteredTemplates.length / PAGE_SIZE)
  const currentPageTemplates = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredTemplates.slice(start, start + PAGE_SIZE)
  }, [filteredTemplates, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [templateSearch])

  useEffect(() => {
    if (!open || creationMode !== 'template' || selectedTemplateId || templates.length === 0) return
    applySelectedTemplate(templates[0])
  }, [open, creationMode, selectedTemplateId, templates])

  useEffect(() => {
    if (!open) return
    if (sourceBoard?.title) {
      setNewTemplateName(`${sourceBoard.title} 模板`)
    }
  }, [open, sourceBoard?.title])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || isSubmitting) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          templateId: creationMode === 'template' ? selectedTemplateId || undefined : undefined,
        }),
      })

      if (!response.ok) throw new Error('Failed to create board')

      const result = await response.json()
      if (result.success) {
        onBoardCreated(result.data)
        toastSuccess('看板创建成功')
        handleReset()
        onOpenChange(false)
      }
    } catch (error) {
      toastError('创建看板失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleReset() {
    setStep('mode')
    setCreationMode('blank')
    setSelectedTemplateId('')
    setSelectedTemplateName('默认看板')
    setSelectedTemplateLaneCount(0)
    setNewTemplateName(sourceBoard?.title ? `${sourceBoard.title} 模板` : '')
    setIncludeCardSkeletons(false)
    setTitle('')
    setTemplateSearch('')
    setShowTemplateManager(false)
    setCurrentPage(1)
  }

  function handleClose() {
    if (!isSubmitting) {
      handleReset()
      onOpenChange(false)
    }
  }

  function handleNext() {
    setStep('title')
  }

  function handleBack() {
    setStep('mode')
  }

  const applySelectedTemplate = (template: Template) => {
    setSelectedTemplateId(template.meta.id)
    setSelectedTemplateName(template.meta.name)
    const content = template.content as { lanes?: { title: string }[] }
    setSelectedTemplateLaneCount(content.lanes?.length || 0)
    setCreationMode('template')
  }

  const selectBlankMode = () => {
    setCreationMode('blank')
    setSelectedTemplateId('')
    setSelectedTemplateName('空白看板')
    setSelectedTemplateLaneCount(3)
  }

  const selectTemplateMode = () => {
    setCreationMode('template')
    if (!selectedTemplateId && templates.length > 0) {
      applySelectedTemplate(templates[0])
    }
  }

  async function handleCreateTemplateFromCurrent() {
    if (!sourceBoard) {
      toastError('当前没有可用于保存模板的看板数据')
      return
    }
    if (!newTemplateName.trim() || savingTemplate) return

    setSavingTemplate(true)
    try {
      const created = await createTemplate({
        meta: {
          type: 'board',
          name: newTemplateName.trim(),
          scope: 'global',
          builtin: false,
          description: `来自看板「${sourceBoard.title}」`,
          tags: ['看板'],
        },
        content: {
          lanes: sourceBoard.lanes.map((lane) => ({
            title: lane.title,
            cards: includeCardSkeletons
              ? lane.cards.map((card) => ({
                  title: card.title,
                  description: card.description,
                  tags: (card.tags || []).map((tag) => tag.name),
                }))
              : undefined,
          })),
          tags: sourceBoard.tags || [],
        },
      })
      applySelectedTemplate(created)
      toastSuccess('已将当前看板创建模板')
      await fetchTemplates()
    } catch {
      toastError('创建模板失败')
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-5xl">
        {step === 'mode' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">创建看板</DialogTitle>
            </DialogHeader>
            <DialogBody>
              {/* 模板选择区域 - 主体 */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="搜索模板..."
                    className="h-9 pl-9 pr-8 text-sm"
                  />
                  {templateSearch && (
                    <button
                      type="button"
                      onClick={() => setTemplateSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="清空模板搜索"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">加载模板中...</div>
                ) : templates.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    暂无看板模板，可到模板管理中新建模板
                    <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => fetchTemplates()}>
                      重新加载
                    </Button>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">未找到匹配的模板</div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-3">
                      {currentPageTemplates.map((template) => (
                        <TemplateCard
                          key={template.meta.id}
                          template={template}
                          selected={selectedTemplateId === template.meta.id}
                          onSelect={applySelectedTemplate}
                          showActions={false}
                        />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 辅助选项 */}
              <div className="mt-4 border-t pt-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={selectBlankMode}
                    className={`flex flex-1 items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm ${
                      creationMode === 'blank'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <PlusCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">空白看板</div>
                      <div className="text-xs text-muted-foreground">使用默认三列表创建</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMode('save-current')}
                    className={`flex flex-1 items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm ${
                      creationMode === 'save-current'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <Save className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">将当前看板创建模板</div>
                      <div className="text-xs text-muted-foreground">保存当前结构后用于后续复用</div>
                    </div>
                  </button>
                </div>
              </div>

              {creationMode === 'save-current' && (
                <div className="mt-3 space-y-2 rounded-md border border-border p-3">
                  <label htmlFor="new-template-name" className="text-xs font-medium text-foreground">
                    模板名称
                  </label>
                  <Input
                    id="new-template-name"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="输入模板名称"
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {sourceBoard ? `将基于「${sourceBoard.title}」生成模板` : '未检测到当前看板'}
                  </p>
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border"
                      checked={includeCardSkeletons}
                      onChange={(e) => setIncludeCardSkeletons(e.target.checked)}
                    />
                    包含卡片骨架（标题/描述/标签）
                  </label>
                  {sourceBoard && (
                    <p className="text-[11px] text-muted-foreground">
                      当前看板：{sourceBoard.lanes.length} 列表，{sourceBoard.lanes.reduce((sum, lane) => sum + lane.cards.length, 0)} 张卡片
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    onClick={() => void handleCreateTemplateFromCurrent()}
                    disabled={!newTemplateName.trim() || savingTemplate || !sourceBoard}
                  >
                    {savingTemplate ? '创建中...' : '保存为模板并选中'}
                  </Button>
                </div>
              )}

              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => setShowTemplateManager(true)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  打开模板管理
                </Button>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                disabled={creationMode === 'template' ? !selectedTemplateId : false}
              >
                下一步
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base">创建看板</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="board-title" className="text-xs font-medium text-foreground">
                    看板名称 <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="board-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：项目开发、市场营销"
                    disabled={isSubmitting}
                    autoFocus
                    className="h-9 text-sm"
                  />
                </div>
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {creationMode === 'template'
                    ? `已选择模板：${selectedTemplateName}，包含 ${selectedTemplateLaneCount} 个列表`
                    : '创建方式：空白看板（默认三列表）'}
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={handleBack} disabled={isSubmitting}>
                返回
              </Button>
              <Button type="submit" size="sm" disabled={!title.trim() || isSubmitting}>
                {isSubmitting ? '创建中...' : '创建看板'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
        <DialogContent className="h-[min(760px,88vh)] max-w-5xl p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="text-base">模板管理</DialogTitle>
          </DialogHeader>
          <DialogBody className="min-h-0 p-0">
            <TemplateManager />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
