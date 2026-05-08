# 开发指南

本文档面向开发者，涵盖项目架构、数据存储、组件设计和 API 规范。

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.1.6 | App Router、服务端渲染 |
| React | 19.2.3 | UI 框架 |
| TypeScript | 5.x | 类型安全（strict: false） |
| Tailwind CSS | v4 | 样式系统 |
| Radix UI | Latest | 无头组件库 |
| @dnd-kit | 6.x / 10.x | 拖放功能 |
| lucide-react | 0.563.0 | 图标库 |
| sonner | 2.x | Toast 通知 |
| DeepSeek API | - | AI 提供商 |

---

## 项目结构

```
kanban-board/
├── app/                  # Next.js App Router
│   ├── api/             # API 路由
│   ├── layout.tsx       # 根布局
│   ├── page.tsx         # 主页面（服务端组件）
│   └── globals.css      # 全局样式
├── components/          # React 客户端组件
│   ├── board/          # 看板组件（BoardClient、Selector、Dialog）
│   ├── lane/           # 列表组件（LaneItem、Dialog）
│   ├── card/           # 卡片组件（CardItem、DraggableCard、Dialog、TagSelector）
│   ├── ai/             # AI 组件（ChatPanel、ToolCallConfirmation、OperationLogPanel）
│   └── ui/             # UI 基础组件（shadcn/ui 封装）
├── lib/                 # 核心库
│   ├── ai/             # AI 命令解析
│   ├── ai-tools/       # AI 工具系统（注册表、执行器、Prompt 构建）
│   ├── hooks/          # 自定义 Hooks（settings、chat、search、shortcuts）
│   ├── storage/        # 存储层（Markdown 文件、缓存、文件锁）
│   ├── templates/      # 看板模板
│   ├── validation/     # Zod Schema 验证
│   ├── api/            # API 响应中间件
│   ├── db.ts           # dbHelpers 兼容层
│   ├── drag-utils.ts   # 拖放工具
│   └── reorder.ts      # 排序算法
├── types/               # TypeScript 类型定义
├── data/                # 数据存储（Markdown 文件、settings.json）
└── docs/                # 项目文档
```

---

## 数据存储

### Markdown 文件存储

每个看板存储为独立的 `.md` 文件，路径为 `data/{board-id}.md`：

```markdown
---
id: default-board
title: 我的看板
tags:
  - id: tag-0
    name: 紧急
    color: '#ef4444'
lanes:
  - id: lane-xxx
    boardId: default-board
    title: 待办
    position: 0
    cards:
      - id: card-xxx
        laneId: lane-xxx
        title: 示例卡片
        description: 描述内容
        position: 0
        tags: []
        createdAt: '2024-01-01T00:00:00.000Z'
        updatedAt: '2024-01-01T00:00:00.000Z'
    createdAt: '2024-01-01T00:00:00.000Z'
    updatedAt: '2024-01-01T00:00:00.000Z'
createdAt: '2024-01-01T00:00:00.000Z'
updatedAt: '2024-01-01T00:00:00.000Z'
---
```

**存储组件**：

| 组件 | 路径 | 职责 |
|------|------|------|
| `StorageAdapter` | `lib/storage/StorageAdapter.ts` | 主存储类，实现 dbHelpers 兼容接口 |
| `MarkdownBoard` | `lib/storage/MarkdownBoard.ts` | Markdown 文件读写 |
| `BoardCache` | `lib/storage/BoardCache.ts` | 内存缓存（LRU 50 上限，TTL 5 分钟） |
| `FileLock` | `lib/storage/FileLock.ts` | 文件锁，防止并发写入 |
| `SettingsStorage` | `lib/storage/SettingsStorage.ts` | 应用设置 JSON 文件读写 |
| `ChatHistoryStorage` | `lib/storage/ChatHistoryStorage.ts` | AI 聊天历史持久化 |

**缓存策略**：
- 读缓存：`getBoard()` 优先从 `BoardCache` 读取
- 写缓存：每次写操作后更新缓存
- 索引：`getBoards()` 优先从 `data/_boards.json` 索引文件读取

**设置存储**：`data/settings.json` 包含 AI 设置、看板视图设置、全局标签等。

---

## 组件架构

### 看板层 (components/board/)

| 组件 | 职责 |
|------|------|
| `BoardClient` | 主客户端组件，管理拖放状态、卡片/列表操作、乐观更新 |
| `BoardClientNoSSR` | 防水合包装器，动态导入解决 SSR 问题 |
| `BoardSelector` | 看板选择下拉菜单，支持搜索过滤 |
| `CreateBoardDialog` / `EditBoardDialog` | 看板创建/编辑/归档对话框 |

### 列表层 (components/lane/)

| 组件 | 职责 |
|------|------|
| `LaneItem` | 可拖放列表容器，包含卡片列表（Droppable + Sortable） |
| `CreateLaneDialog` / `EditLaneDialog` | 列表创建/编辑对话框 |

### 卡片层 (components/card/)

| 组件 | 职责 |
|------|------|
| `CardItem` | 纯展示组件，渲染标签、标题、描述、时间 |
| `DraggableCard` | 包装 CardItem，使其可拖放（Sortable） |
| `CardFormDialog` | 统一的卡片表单对话框（创建/编辑共用） |
| `TagSelector` | 从看板预设标签池中选择标签 |

### AI 层 (components/ai/)

| 组件 | 职责 |
|------|------|
| `DeepSeekChatPanel` | AI 聊天界面（orchestrator，约 474 行） |
| `ChatMessageList` / `ChatInputArea` | 消息列表与输入区域 |
| `ToolCallConfirmation` | 工具调用确认对话框 |
| `OperationLogPanel` | 操作日志面板 |

### 拖放架构

```
BoardClient (DndContext)
├── LaneItem (Droppable + Sortable)
│   └── SortableContext
│       └── DraggableCard (Sortable)
│           └── CardItem
└── DragOverlay (拖拽预览)
```

---

## API 规范

### 通用响应格式

```typescript
// 成功
{ success: true, data: T }

// 错误
{ success: false, error: string }
```

### REST API

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/boards` | GET/POST | 获取所有看板 / 创建看板 |
| `/api/boards/[boardId]` | GET/PATCH/DELETE | 看板详情 / 更新 / 删除 |
| `/api/boards/[boardId]/archive` | POST | 归档看板 |
| `/api/boards/[boardId]/unarchive` | POST | 恢复看板 |
| `/api/boards/[boardId]/export` | GET | 导出看板（JSON/CSV/Markdown） |
| `/api/boards/import` | POST | 导入看板 |
| `/api/lanes` | POST/PATCH/DELETE | 列表 CRUD |
| `/api/lanes/reorder` | POST | 重排序列表 |
| `/api/cards` | POST/PATCH/DELETE | 卡片 CRUD |
| `/api/cards/move` | POST | 跨列表移动卡片 |
| `/api/cards/reorder` | POST | 同列表卡片重排序 |
| `/api/cards/batch-move` | POST | 批量移动卡片 |
| `/api/cards/batch-delete` | POST | 批量删除卡片 |
| `/api/cards/batch-update-tags` | POST | 批量更新卡片标签 |
| `/api/cards/[cardId]/attachments` | POST/DELETE | 附件上传/删除 |
| `/api/tags` | POST | 创建标签 |
| `/api/settings` | GET/PUT/DELETE | 获取/更新/重置设置 |
| `/api/settings/ai` | GET/PUT | AI 设置 |
| `/api/settings/ai/commands` | GET/PUT | AI 命令 |
| `/api/settings/ai/tool-trigger` | GET/PUT | 工具触发配置 |
| `/api/debug/reset-db` | POST | 重置数据库（开发环境） |

### AI API

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/ai/chat` | POST | DeepSeek 聊天接口（30 秒超时） |
| `/api/ai/chat/history` | GET/POST/DELETE | AI 聊天历史管理 |
| `/api/ai/tools/execute` | POST | 执行 AI 工具调用 |

### 验证中间件

使用 `withValidation(schema, handler)` 统一验证：

```typescript
import { withValidation } from '@/lib/api/validate'
import { CreateCardSchema } from '@/lib/validation/schema'

export const POST = withValidation(CreateCardSchema, async (data) => {
  const card = await dbHelpers.createCard(data.boardId, data.laneId, data.title, data.description)
  return successResponse(card, 201)
})
```

---

## 关键设计决策

1. **Markdown 文件存储**：替代 JSON 数据库，兼顾人类可读性和结构化数据
2. **内存缓存**：`BoardCache` 使用 LRU 策略（最大 50 个），减少文件 I/O
3. **文件锁**：`FileLock` 防止并发写入冲突
4. **乐观更新**：前端先更新 UI，API 成功后再确认，失败时自动回滚
5. **服务端组件优先**：数据获取在服务端完成，减少客户端 JavaScript
