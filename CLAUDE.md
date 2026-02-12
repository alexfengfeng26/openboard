# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 **Next.js 16**、**React 19** 和 **lowdb** 构建的现代化看板系统（Kanban Board），支持多看板管理、拖放排序和 AI 集成。

## 开发命令

```bash
# 开发服务器
pnpm dev

# 生产构建
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint
```

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19
- **样式**: Tailwind CSS v4 + Radix UI 组件
- **拖放**: @dnd-kit (core, sortable, utilities)
- **数据持久化**: lowdb (JSON 文件存储)
- **语言**: TypeScript (strict mode)
- **图标**: lucide-react
- **AI 提供商**: DeepSeek API

## 架构要点

### 目录结构

```
app/                      # Next.js App Router
  api/                    # API 路由
  layout.tsx              # 根布局
  page.tsx                # 主页面（服务端组件）
  globals.css               # 全局样式

components/
  board/                  # 看板相关客户端组件
    BoardClient.tsx       # 主看板组件（拖放逻辑）
    BoardClientNoSSR.tsx  # 防水合包装器
    BoardSelector.tsx      # 看板选择器
  card/                   # 卡片组件
    CardItem.tsx          # 卡片展示组件
    DraggableCard.tsx     # 可拖放卡片包装器
    CreateCardDialog.tsx   # 创建卡片对话框
    EditCardDialog.tsx     # 编辑卡片对话框
    TagSelector.tsx        # 标签选择器
  lane/                   # 列表组件
    LaneItem.tsx           # 列表容器（可拖放）
    CreateLaneDialog.tsx   # 创建列表对话框
    EditLaneDialog.tsx     # 编辑列表对话框
  ui/                     # Radix UI 封装组件
  ai/                     # AI 相关组件
    DeepSeekChatPanel.tsx # 主聊天面板
    ToolCallConfirmation.tsx # 工具调用确认对话框
    OperationLogPanel.tsx   # 操作日志面板

lib/
  db.ts                   # 数据库层（lowdb + 类型定义）
  drag-utils.ts           # 拖放工具函数
  reorder.ts             # 排序算法
  utils.ts               # 通用工具函数
  ai-tools/               # AI 工具系统
    index.ts               # 导出入口
    server-executor.ts      # 服务端工具执行器
    prompt/builder.ts      # Prompt 构建器
    parser/tool-call-parser.ts  # 工具调用解析器
    tools/                 # 工具定义
      base.ts           # 工具基类
      registry.ts       # 工具注册表（单例）
      board-tools.ts    # 看板工具
      card-tools.ts     # 卡片工具
      lane-tools.ts      # 列表工具

data/
  db.json                 # 数据存储文件（自动生成）

types/
  index.ts               # 类型导出
  board.types.ts          # 看板类型
  lane.types.ts           # 列表类型
  card.types.ts           # 卡片类型
  api.types.ts           # API 响应类型
  ai-tools.types.ts      # AI 工具类型
  drag-drop.types.ts      # 拖放类型
```

### 数据模型

```typescript
Board                    // 看板
  └── lanes: Lane[]      // 列表
       └── cards: Card[] // 卡片
       └── tags?: Tag[]  // 可选标签

Lane                     // 列表
  └── cards: Card[]

Card                     // 卡片
  id, laneId, title, description, position, createdAt, updatedAt, tags?
```

**关键设计**：
- `Board.tags` 是看板级别的预设标签池
- `Card.tags` 引用看板标签，存储时包含完整标签对象
- 所有实体都有 `position` 字段用于排序
- 所有实体都有 `createdAt/updatedAt` 时间戳

### 数据库设计 (lib/db.ts)

使用 **lowdb** 存储 JSON 数据到 `data/db.json`：

- **单例模式**: `getDb()` 返回共享实例
- **默认数据**: 包含 3 个预设看板（我的看板、Scrum、Bug 跟踪）
- **辅助函数**: `dbHelpers` 对象提供所有 CRUD 操作

**重要**: 部分函数（如 `moveCard`、`createCard`）仍硬编码使用 `'default-board'`，新函数应接受 `boardId` 参数。

### 拖放架构

使用 **@dnd-kit** 实现：

1. **BoardClient** 维护全局 `DndContext`
2. **LaneItem** 是 Droppable 容器
3. **DraggableCard** 是 Sortable 项目

**拖放工具** (lib/drag-utils.ts):
- `getDragType()`: 从 `data.current.type` 获取类型 ('CARD' | 'LANE')
- `findCardById()`: 跨列表查找卡片
- `handleCardMoveAcrossLanes()`: 处理跨列表移动

**排序算法** (lib/reorder.ts):
- 使用中间值插入法 (`calculateInsertPosition`)
- 当间隙不足时进行标准化 (`normalizePositions`)

### 组件设计模式

**服务端 vs 客户端分离**:
- `app/page.tsx`: 服务端组件，获取初始数据
- `BoardClientNoSSR`: 动态导入包装器，防止服务端渲染客户端特定内容

**状态管理模式**:
- 乐观更新：先更新 UI，失败时回滚
- 看板列表缓存：`boards` state 独立于当前 `board`
- 回调模式：子组件通过回调更新父组件状态

### API 路由设计

所有 API 遵循统一响应格式：
```typescript
{ success: boolean, data?: T, error?: string }
```

路由规范：
- `GET /api/boards` - 获取所有看板（轻量）
- `GET /api/boards/[boardId]` - 获取单个看板详情
- `POST /api/boards` - 创建看板
- `PATCH /api/boards/[boardId]` - 更新看板
- `DELETE /api/boards/[boardId]` - 删除看板（至少保留一个）
- `POST /api/cards/move` - 移动卡片

### UI 组件库

**components/ui/** 基于 Radix UI 的封装：
- 使用 `class-variance-authority` 管理变体
- 使用 `cn()` (clsx + tailwind-merge) 合并类名
- 所有对话框使用 Dialog 包装器

### 样式系统

- **Tailwind CSS v4**: 使用 `@tailwindcss/postcss`
- **响应式**: 移动端显示 "Chat" 按钮，桌面端显示侧边栏
- **拖放反馈**: `isHovered` 状态控制目标高亮

## 重要注意事项

### 已知问题

1. **硬编码的 boardId**: `dbHelpers.moveCard`、`createCard` 等函数使用 `'default-board'`
2. **列表删除后刷新**: `LaneItem` 删除列表后使用 `window.location.reload()`
3. **Hydration 警告**: `DraggableCard` 中的 `transform`/`transition` 为 undefined 时导致 style 属性为字符串 "undefined"

### 开发建议

1. **新增 API**: 遵循现有响应格式和错误处理模式
2. **类型定义**: 所有数据库操作类型定义在 `lib/db.ts`
3. **拖放调试**: 检查 `data.current` 对象确保 `type` 和 `laneId` 正确传递
4. **看板切换**: 使用 `BoardSelector` 组件，处理 URL 参数 `?boardId=xxx`
5. **AI 集成**: 工具定义在 `lib/ai-tools/tools/` 目录，服务端执行在 `server-executor.ts`

### AI 工具调用架构

**工具定义位置**: `lib/ai-tools/tools/` （客户端使用，仅包含元数据）
**工具执行位置**: `lib/ai-tools/server-executor.ts` （服务端使用，调用 dbHelpers）
**执行 API**: `POST /api/ai/tools/execute`

**工作流程**:
1. 用户在 Chat 输入自然语言指令
2. `PromptBuilder` 构建包含工具定义的系统提示词
3. DeepSeek 返回 JSON 格式的工具调用
4. `ToolCallParser` 解析 AI 响应
5. 显示 `ToolCallConfirmation` 对话框供用户确认
6. 确认后调用 `/api/ai/tools/execute`
7. `ServerToolExecutor` 执行工具（通过 `dbHelpers`）
8. 结果记录到 `OperationLogPanel`

### 快捷模板

`DeepSeekChatPanel` 内置的快捷提示模板：

```typescript
const quickTemplates = [
  { label: '生成待办任务', text: '...' },
  { label: '拆分为子任务', text: '...' },
  { label: '总结为卡片', text: '...' },
]
```

### 环境变量

```bash
# DeepSeek API
DEEPSEEK_API_KEY=sk-xxx
```

该变量已配置在 `.env` 文件中，不会被提交到版本控制。
