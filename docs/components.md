# Components 组件文档

本文档详细说明 kanban-board 项目的所有组件结构、功能和用法。

---

## 目录结构

```
components/
├── board/              # 看板相关组件
│   ├── BoardClient.tsx       # 主看板组件（客户端）
│   ├── BoardClientNoSSR.tsx  # 防水合包装器
│   ├── BoardSelector.tsx      # 看板选择器
│   ├── CreateBoardDialog.tsx   # 创建看板对话框
│   └── EditBoardDialog.tsx    # 编辑看板对话框
├── lane/               # 列表相关组件
│   ├── LaneItem.tsx          # 列表容器（可拖放）
│   ├── CreateLaneDialog.tsx   # 创建列表对话框
│   └── EditLaneDialog.tsx     # 编辑列表对话框
├── card/               # 卡片相关组件
│   ├── CardItem.tsx          # 卡片展示组件
│   ├── DraggableCard.tsx     # 可拖放卡片包装器
│   ├── CreateCardDialog.tsx   # 创建卡片对话框
│   ├── EditCardDialog.tsx     # 编辑卡片对话框
│   ├── CardFormDialog.tsx     # 通用卡片表单对话框
│   └── TagSelector.tsx       # 标签选择器
├── ai/                 # AI 相关组件
│   ├── DeepSeekChatPanel.tsx      # 主聊天面板
│   ├── ToolCallConfirmation.tsx     # 工具调用确认对话框
│   └── OperationLogPanel.tsx       # 操作日志面板
└── ui/                 # Radix UI 封装组件
    ├── alert-dialog.tsx      # 警告对话框
    ├── badge.tsx            # 徽章
    ├── button.tsx           # 按钮
    ├── confirm-dialog.tsx    # 确认对话框
    ├── dialog.tsx           # 对话框
    ├── input.tsx            # 输入框
    ├── textarea.tsx         # 文本区域
    └── toast.tsx            # 提示通知
```

---

## 看板组件 (board/)

### BoardClient

**文件**: `components/board/BoardClient.tsx`

**类型**: Client Component (`'use client'`)

**功能**:
- 看板的主要客户端组件
- 管理拖放状态和逻辑
- 处理卡片/列表的创建、编辑、删除
- 乐观更新 UI 状态

**状态管理**:
```typescript
type BoardClientState = {
  board: Board              // 当前看板
  boards: Board[]          // 所有看板列表
  activeId: string | null  // 正在拖拽的元素 ID
  activeType: 'CARD' | 'LANE' | null  // 拖拽类型
  showCreateLane: boolean  // 显示创建列表对话框
  editingCard: Card | null  // 正在编辑的卡片
  hoveredLaneId: string | null  // 悬停的列表 ID
  showChat: boolean        // 显示聊天面板
}
```

**核心功能**:
- `handleDragStart`: 拖拽开始，记录激活的元素
- `handleDragOver`: 拖拽移动时更新悬停状态
- `handleDragEnd`: 拖拽结束，处理移动逻辑
  - 同列表内重排序（使用 arrayMove）
  - 跨列表移动（计算新位置）
  - 列表重排序
- `refreshCurrentBoard`: 刷新当前看板数据
- `handleCardCreatedFromChat`: AI 创建卡片回调

**使用的 Hook**: `useReducer` - 使用 reducer 模式管理复杂状态

---

### BoardClientNoSSR

**文件**: `components/board/BoardClientNoSSR.tsx`

**类型**: Client Component (`'use client'`)

**功能**: 防水合包装器，使用动态导入防止服务端渲染问题

**关键代码**:
```typescript
return (
  <div suppressHydrationWarning>
    <BoardClient initialBoard={board} initialBoards={boards} />
  </div>
)
```

**用途**: 解决 `@dnd-kit` 在 SSR 环境下的 hydration 不匹配问题

---

### BoardSelector

**文件**: `components/board/BoardSelector.tsx`

**类型**: Client Component (`'use client'`)

**功能**:
- 看板选择下拉菜单
- 支持搜索过滤（防抖）
- 创建新看板入口

**Props**:
```typescript
interface BoardSelectorProps {
  boards: Array<{ id: string; title: string; ... }>
  currentBoard: Board
  onBoardChange: (board: Board) => void
  onBoardsRefresh: () => void
}
```

**状态**:
- `isOpen`: 下拉菜单打开状态
- `query`: 搜索关键词
- `debouncedQuery`: 防抖后的搜索词

---

### CreateBoardDialog / EditBoardDialog

**功能**: 创建/编辑看板的对话框组件

**Props**:
```typescript
interface CreateBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBoardCreated: (board: Board) => void
}

interface EditBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  board: Board
  onBoardUpdated: (board: Board) => void
  onBoardDeleted: () => void
}
```

---

## 列表组件 (lane/)

### LaneItem

**文件**: `components/lane/LaneItem.tsx`

**类型**: Client Component (`'use client'`)

**功能**:
- 可拖放的列表容器
- 包含卡片列表（可拖放区域）
- 列表标题编辑和删除
- 卡片计数显示

**Props**:
```typescript
interface LaneItemProps {
  lane: Lane
  onLaneUpdate: (lane: Lane) => void
  onCardEdit?: (card: Card) => void
  isHovered?: boolean     // 拖拽悬停高亮
  onLaneDeleted?: (laneId: string) => void
  boardId: string
}
```

**拖放配置**:
```typescript
// 作为 Droppable（接收卡片）
const { setNodeRef } = useDroppable({
  id: lane.id,
  data: {
    type: 'LANE',
    accepts: ['CARD'],
  },
})

// 作为 Sortable（可重排序）
const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
  id: lane.id,
  data: { type: 'LANE' },
})
```

**UI 结构**:
```
┌─────────────────────────┐
│ ╞═ 列表标题 [3] ✏️  │  ← 头部
├─────────────────────────┤
│                       │
│   卡片 1               │  ← Droppable 区域
│   卡片 2               │     (SortableContext)
│   卡片 3               │
│                       │
├─────────────────────────┤
│ + 添加卡片             │  ← 添加按钮
└─────────────────────────┘
```

**交互**:
- 双击标题编辑列表
- 拖动列表重新排序
- 拖动卡片到此列表

---

### CreateLaneDialog / EditLaneDialog

**功能**: 创建/编辑列表的对话框组件

**核心功能**:
- 输入验证（标题必填）
- 列表删除（至少保留一个）
- 创建/更新后回调

---

## 卡片组件 (card/)

### DraggableCard

**文件**: `components/card/DraggableCard.tsx`

**类型**: Client Component (`'use client'`)

**功能**: 包装 CardItem，使其可拖放

**Props**:
```typescript
interface DraggableCardProps {
  card: Card
  onEdit?: (card: Card) => void
}
```

**拖放配置**:
```typescript
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: card.id,
  data: {
    type: 'CARD',
    laneId: card.laneId,  // 重要：记录所属列表
  },
})
```

**Hydration 修复**: 只在 `transform` 或 `transition` 存在时设置 style 属性

---

### CardItem

**文件**: `components/card/CardItem.tsx`

**类型**: Client Component (`'use client'`)

**功能**: 纯展示组件，渲染卡片内容

**Props**:
```typescript
interface CardItemProps {
  card: Card
  isDragging?: boolean
  onEdit?: (card: Card) => void
}
```

**UI 结构**:
```
┌──────────────────────────┐
│ [标签] [标签]      ✏️ │  ← 标签 + 编辑按钮
├──────────────────────────┤
│ 卡片标题                │  ← 标题
├──────────────────────────┤
│ 卡片描述...             │  ← 描述（可折叠）
│ [展开/收起]            │
├──────────────────────────┤
│ 2小时前    已编辑       │  ← 时间信息
└──────────────────────────┘
```

**交互**:
- 双击编辑卡片
- 悬停显示编辑按钮
- 长描述可展开/收起

---

### CreateCardDialog / EditCardDialog

**功能**: 创建/编辑卡片的对话框组件

**表单字段**:
- 标题（必填）
- 描述（可选，支持多行）
- 标签选择（可选）

**注意**: 这两个组件存在大量重复代码，建议使用共享的 `CardFormDialog`

---

### TagSelector

**文件**: `components/card/TagSelector.tsx`

**功能**: 标签选择器，支持从看板预设标签中选择

**Props**:
```typescript
interface TagSelectorProps {
  boardId: string
  selectedTags: Tag[]
  onChange: (tags: Tag[]) => void
}
```

**功能**:
- 获取看板预设标签
- 点击切换标签选中状态
- 显示已选标签数量

---

## AI 组件 (ai/)

### DeepSeekChatPanel

**文件**: `components/ai/DeepSeekChatPanel.tsx`

**类型**: Client Component (`'use client'`)

**行数**: ~894 行（建议拆分）

**功能**:
- AI 聊天界面
- 工具调用确认
- 草稿卡片创建
- 操作日志
- 快捷模板

**主要状态**:
```typescript
const [messages, setMessages] = useState<Message[]>([])
const [input, setInput] = useState('')
const [isLoading, setIsLoading] = useState(false)
const [draftCards, setDraftCards] = useState<CardDraft[]>([])
const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallRequest[]>([])
const [showToolConfirm, setShowToolConfirm] = useState(false)
const [operationLogs, setOperationLogs] = useState<OperationLog[]>([])
```

**快捷模板**:
```typescript
const quickTemplates = [
  { label: '生成待办任务', text: '...' },
  { label: '拆分为子任务', text: '...' },
  { label: '总结为卡片', text: '...' },
]
```

**建议拆分为**:
- `ChatMessageList.tsx` - 消息列表
- `ChatInput.tsx` - 输入框
- `DraftCardPanel.tsx` - 草稿面板
- `QuickTemplateSelector.tsx` - 快捷模板

---

### ToolCallConfirmation

**文件**: `components/ai/ToolCallConfirmation.tsx`

**功能**: 工具调用确认对话框

**Props**:
```typescript
interface ToolCallConfirmationProps {
  open: boolean
  toolCalls: ToolCallRequest[]
  onConfirm: () => void
  onCancel: () => void
  lanes: Lane[]  // 用于显示列表名称
}
```

**显示内容**:
- 操作类型（创建/删除/更新/移动）
- 目标对象（卡片/列表/看板）
- 具体参数

---

### OperationLogPanel

**文件**: `components/ai/OperationLogPanel.tsx`

**功能**: 操作日志面板

**Props**:
```typescript
interface OperationLogPanelProps {
  logs: OperationLog[]
  onClear: () => void
}
```

**日志格式**:
```typescript
interface OperationLog {
  id: string
  toolName: string
  success: boolean
  timestamp: string
  data?: unknown
  error?: string
}
```

---

## UI 组件 (ui/)

基于 Radix UI 的封装组件，使用 `class-variance-authority` 管理变体。

### Dialog

**文件**: `components/ui/dialog.tsx`

**导出组件**:
```typescript
export {
  Dialog,           // 根组件
  DialogTrigger,    // 触发器
  DialogContent,    // 内容区域
  DialogHeader,     // 头部
  DialogFooter,     // 底部
  DialogTitle,      // 标题
  DialogDescription, // 描述
  DialogClose,      // 关闭按钮
  DialogOverlay,    // 遮罩层
  DialogPortal,     // 传送门
}
```

**使用示例**:
```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>标题</DialogTitle>
    </DialogHeader>
    <div>内容</div>
    <DialogFooter>
      <Button>取消</Button>
      <Button>确认</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Button

**文件**: `components/ui/button.tsx`

**变体**:
- `variant`: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
- `size`: 'default' | 'sm' | 'lg' | 'icon'

---

### Badge

**文件**: `components/ui/badge.tsx`

**变体**:
- `variant`: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'

**用途**: 卡片标签显示

---

### AlertDialog / ConfirmDialog

**文件**: `components/ui/alert-dialog.tsx`, `components/ui/confirm-dialog.tsx`

**功能**: 需要用户确认的操作（如删除）

---

### Input / Textarea

**文件**: `components/ui/input.tsx`, `components/ui/textarea.tsx`

**功能**: 表单输入控件

---

### Toast

**文件**: `components/ui/toast.tsx`

**功能**: 全局通知提示

**使用**:
```typescript
import { toastError, toastSuccess } from '@/components/ui/toast'

toastError('操作失败')
toastSuccess('操作成功')
```

---

## 组件通信模式

### 父子通信（Props 回调）

```typescript
// 父组件
<LaneItem
  lane={lane}
  onLaneUpdate={(updatedLane) => { ... }}
  onCardEdit={(card) => setEditingCard(card)}
/>

// 子组件
function LaneItem({ lane, onLaneUpdate, onCardEdit }) {
  onLaneUpdate({ ...lane, cards: newCards })
}
```

### Props 钻取问题

```
BoardClient
  └── LaneItem
      └── DraggableCard
          └── CardItem
              └── onEdit 回调需要传递 4 层
```

**解决方案建议**: 使用 Context API 或状态管理库

---

## 拖放架构

### 组件层次

```
BoardClient (DndContext)
├── LaneItem (Droppable + Sortable)
│   └── SortableContext
│       └── DraggableCard (Sortable)
│           └── CardItem
└── DragOverlay (拖拽预览)
```

### 数据流

```
用户拖动 → onDragStart → 设置 activeId/activeType
         → onDragOver → 更新 hoveredLaneId
         → onDragEnd → 执行移动/重排序 → API 调用 → 更新 UI
```

---

## 待优化项

1. **拆分 DeepSeekChatPanel** - 894 行过长
2. **合并 CardForm** - CreateCardDialog 和 EditCardDialog 重复代码
3. **添加 React.memo** - 减少不必要的重渲染
4. **使用 Context** - 避免 props 钻取
5. **统一错误处理** - 添加全局 toast 提示

---

## 相关文档

- [API Routes](./api-routes.md)
- [数据库层](./database.md)
- [架构概述](./architecture.md)
