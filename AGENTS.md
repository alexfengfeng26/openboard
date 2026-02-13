# AGENTS.md

本文件为 AI 编码助手提供项目背景、架构和开发规范指导。

---

## 项目概述

**kanban-board** 是一个基于 **Next.js 16**、**React 19** 和 Markdown 文件存储构建的现代化看板系统（Kanban Board）。

### 核心功能

- **多看板管理** - 支持创建、编辑、删除多个看板
- **拖放排序** - 卡片和列表可自由拖放重排序（基于 @dnd-kit）
- **AI 集成** - 通过 DeepSeek API 实现智能卡片创建和管理
- **实时更新** - 乐观更新 UI，失败时自动回滚
- **操作日志** - 完整记录所有 AI 工具调用
- **标签系统** - 支持为卡片添加自定义标签

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
├── app/                      # Next.js App Router
│   ├── api/                 # API 路由
│   │   ├── ai/
│   │   │   ├── chat/        # DeepSeek 聊天 API
│   │   │   └── tools/       # AI 工具执行 API
│   │   ├── boards/          # 看板 CRUD API
│   │   ├── cards/           # 卡片操作 API
│   │   ├── lanes/           # 列表操作 API
│   │   ├── tags/            # 标签 API
│   │   └── debug/           # 调试 API
│   ├── layout.tsx           # 根布局组件
│   ├── page.tsx             # 主页面（服务端组件）
│   ├── globals.css          # 全局样式
│   └── favicon.ico          # 网站图标
├── components/               # React 客户端组件
│   ├── ai/                  # AI 相关组件
│   │   ├── DeepSeekChatPanel.tsx    # 主聊天面板
│   │   ├── OperationLogPanel.tsx    # 操作日志面板
│   │   └── ToolCallConfirmation.tsx # 工具调用确认对话框
│   ├── board/               # 看板相关组件
│   │   ├── BoardClient.tsx       # 主看板组件（拖放逻辑）
│   │   ├── BoardClientNoSSR.tsx  # 防水合包装器
│   │   ├── BoardSelector.tsx     # 看板选择器
│   │   ├── CreateBoardDialog.tsx # 创建看板对话框
│   │   └── EditBoardDialog.tsx   # 编辑看板对话框
│   ├── card/                # 卡片相关组件
│   │   ├── CardItem.tsx          # 卡片展示组件
│   │   ├── DraggableCard.tsx     # 可拖放卡片包装器
│   │   ├── CardFormDialog.tsx    # 统一的卡片表单对话框
│   │   ├── CreateCardDialog.tsx  # 创建卡片对话框
│   │   ├── EditCardDialog.tsx    # 编辑卡片对话框
│   │   └── TagSelector.tsx       # 标签选择器
│   ├── lane/                # 列表相关组件
│   │   ├── LaneItem.tsx          # 列表容器（可拖放）
│   │   ├── CreateLaneDialog.tsx  # 创建列表对话框
│   │   └── EditLaneDialog.tsx    # 编辑列表对话框
│   └── ui/                  # UI 基础组件（Radix UI 封装）
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── toast.tsx
│       └── ...
├── lib/                      # 核心库和工具
│   ├── db.ts                # 数据库层（兼容层，实际使用 StorageAdapter）
│   ├── drag-utils.ts        # 拖放工具函数
│   ├── reorder.ts           # 排序算法
│   ├── utils.ts             # 通用工具函数
│   ├── ai/                  # AI 命令解析
│   │   ├── commands.ts
│   │   └── card-draft-parser.ts
│   ├── ai-tools/            # AI 工具系统
│   │   ├── index.ts         # 模块导出
│   │   ├── server-executor.ts
│   │   ├── parser/          # 工具调用解析器
│   │   │   ├── tool-call-parser.ts
│   │   │   └── fallback-tool-parser.ts
│   │   ├── prompt/          # Prompt 构建
│   │   │   └── builder.ts
│   │   └── tools/           # 工具实现
│   │       ├── base.ts      # 工具基类
│   │       ├── registry.ts  # 工具注册表
│   │       ├── card-tools.ts
│   │       ├── lane-tools.ts
│   │       └── board-tools.ts
│   └── storage/             # 存储层（Markdown 文件存储）
│       ├── StorageAdapter.ts
│       ├── MarkdownBoard.ts
│       ├── BoardCache.ts
│       └── FileLock.ts
├── types/                    # TypeScript 类型定义
│   ├── index.ts
│   ├── board.types.ts
│   ├── lane.types.ts
│   ├── card.types.ts
│   ├── ai-tools.types.ts
│   └── storage.types.ts
├── data/                     # 数据存储目录
│   ├── *.md                 # 看板 Markdown 文件
│   ├── db.json              # 遗留 JSON 数据库（已迁移）
│   └── .migration-complete  # 迁移标记
├── docs/                     # 项目文档
│   ├── index.md
│   ├── ai-tools-system.md
│   ├── ai-tools-guide.md
│   ├── api-routes.md
│   ├── components.md
│   └── database.md
└── config/                   # 配置文件
```

---

## 构建和开发命令

### 包管理器

项目使用 **pnpm** 作为包管理器。

### 可用脚本

```bash
# 开发服务器（端口 3000）
pnpm dev

# 生产构建
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint

# 运行测试
pnpm test

# 测试监听模式
pnpm test:watch

# 测试覆盖率
pnpm test:coverage
```

---

## 数据模型

### Board（看板）

```typescript
interface Board {
  id: string
  title: string
  lanes: Lane[]
  tags?: Tag[]          // 看板级预设标签池
  createdAt: string
  updatedAt: string
}
```

### Lane（列表）

```typescript
interface Lane {
  id: string
  boardId: string
  title: string
  cards: Card[]
  position: number
  createdAt: string
  updatedAt: string
}
```

### Card（卡片）

```typescript
interface Card {
  id: string
  laneId: string
  title: string
  description?: string
  position: number
  createdAt: string
  updatedAt: string
  tags?: Tag[]          // 引用看板标签
}
```

### Tag（标签）

```typescript
interface Tag {
  id: string
  name: string
  color: string        // 十六进制颜色值
}
```

---

## 存储架构

### Markdown 文件存储

项目使用 **Markdown 文件**作为数据持久化方案（替代原有的 lowdb JSON 存储）：

- 每个看板存储为一个独立的 `.md` 文件
- 文件路径：`data/{board-id}.md`
- 自动从 JSON 迁移（一次性）
- 支持文件锁机制防止并发写入冲突

### 存储组件

| 组件 | 职责 |
|------|------|
| `StorageAdapter` | 主存储类，实现 dbHelpers 兼容接口 |
| `MarkdownBoard` | Markdown 文件读写操作 |
| `BoardCache` | 内存缓存，减少文件 I/O |
| `FileLock` | 文件锁，防止并发写入 |

### 预设标签颜色

```typescript
const TAG_COLORS = [
  { name: '紧急', color: '#ef4444' },
  { name: '功能', color: '#3b82f6' },
  { name: 'Bug', color: '#f59e0b' },
  { name: '优化', color: '#10b981' },
  { name: '文档', color: '#8b5cf6' },
  { name: '设计', color: '#ec4899' },
]
```

---

## AI 工具系统

### 架构概述

AI 工具系统允许 DeepSeek AI 直接操作看板数据：

1. **PromptBuilder** - 构建包含工具定义的系统提示词
2. **ToolRegistry** - 单例模式管理所有可用工具
3. **BaseTool** - 所有工具的抽象基类
4. **ToolCallParser** - 解析 AI 返回的工具调用 JSON
5. **ServerToolExecutor** - 服务端执行工具调用

### 可用工具

| 工具名 | 类别 | 描述 |
|--------|------|------|
| `create_card` | card | 创建新卡片 |
| `update_card` | card | 更新卡片 |
| `move_card` | card | 移动卡片到不同列表 |
| `delete_card` | card | 删除卡片 |
| `create_lane` | lane | 创建新列表 |
| `update_lane` | lane | 更新列表 |
| `delete_lane` | lane | 删除列表 |
| `create_board` | board | 创建新看板 |
| `update_board` | board | 更新看板 |
| `delete_board` | board | 删除看板 |

### 工具调用流程

```
用户输入 -> DeepSeekChatPanel -> /api/ai/chat -> DeepSeek API
                                                      |
                                                      v
                                           返回工具调用 JSON
                                                      |
                                                      v
                                           /api/ai/tools/execute
                                                      |
                                                      v
                                           ServerToolExecutor -> 工具执行 -> 更新数据
```

---

## API 路由

### REST API

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/boards` | GET | 获取所有看板列表 |
| `/api/boards` | POST | 创建新看板 |
| `/api/boards/[boardId]` | GET | 获取单个看板 |
| `/api/boards/[boardId]` | PUT | 更新看板 |
| `/api/boards/[boardId]` | DELETE | 删除看板 |
| `/api/lanes` | POST | 创建列表 |
| `/api/lanes/reorder` | POST | 重排序列表 |
| `/api/cards` | POST | 创建卡片 |
| `/api/cards/reorder` | POST | 同列表卡片重排序 |
| `/api/cards/move` | POST | 跨列表移动卡片 |
| `/api/tags` | GET | 获取标签 |

### AI API

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/ai/chat` | POST | DeepSeek 聊天接口 |
| `/api/ai/tools/execute` | POST | 执行 AI 工具调用 |

---

## 代码风格指南

### TypeScript 配置

- `strict: false` - 非严格模式
- 使用路径别名 `@/*` 指向项目根目录
- 类型定义统一放在 `types/` 目录

### 组件规范

1. **服务端组件** - 默认使用，数据获取在服务端完成
2. **客户端组件** - 需要交互的使用 `'use client'` 指令
3. **防水合处理** - 拖放组件使用 `BoardClientNoSSR` 包装

### 命名约定

- 组件文件：PascalCase（如 `BoardClient.tsx`）
- 工具文件：camelCase（如 `drag-utils.ts`）
- 类型文件：kebab-case.types.ts（如 `board.types.ts`）
- API 路由：route.ts

### 错误处理

- 使用 `sonner` 的 `toastError` 替代 `alert()` 和 `console.error()`
- API 返回统一格式：`{ success: boolean, data?: any, error?: string }`

### 状态管理

- 使用 `useReducer` 管理复杂组件状态（如 `BoardClient`）
- 乐观更新 UI，失败时自动回滚

---

## 测试策略

### 测试框架

- **Vitest** - 单元测试框架
- **@vitest/coverage-v8** - 覆盖率报告

### 测试配置

- 测试文件：`**/*.test.ts`
- 排除目录：`node_modules`, `.next`, `dist`, `build`
- 环境：`node`

### 现有测试文件

- `app/api/ai/tools/execute/route.test.ts`
- `lib/ai/commands.test.ts`
- `lib/ai-tools/parser/tool-call-parser.test.ts`
- `lib/ai/card-draft-parser.test.ts`

### 运行测试

```bash
# 一次性运行
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage
```

---

## 开发注意事项

### 环境变量

创建 `.env` 文件（已排除版本控制）：

```bash
DEEPSEEK_API_KEY=your_api_key_here
```

### 数据存储

- 看板数据存储在 `data/` 目录下的 Markdown 文件
- 不要手动编辑 `.md` 文件，通过应用界面操作
- 文件锁机制自动处理并发，但避免同时启动多个开发服务器

### 防水合（Hydration）

- `BoardClientNoSSR` 使用动态导入防止 SSR 问题
- 客户端组件使用 `suppressHydrationWarning` 属性

### 拖放功能

- 使用 `@dnd-kit` 库实现
- 支持键盘操作和无障碍访问
- 拖放传感器配置：`distance: 3`（降低触发阈值）

### AI 集成

- DeepSeek API 需要有效的 API Key
- 工具调用使用标准 JSON 格式
- 降级解析器处理非标准 AI 响应

---

## 部署

### 构建输出

Next.js 默认输出到 `.next/` 目录。

### 目标平台

- 主要目标：Vercel
- 支持 Node.js 运行时

### 部署前检查

1. 确认 `DEEPSEEK_API_KEY` 环境变量已配置
2. 运行 `pnpm build` 确保构建成功
3. 运行 `pnpm test` 确保测试通过

---

## 常见问题

### 数据迁移

从 JSON 到 Markdown 的迁移是自动的：
- 检测 `data/db.json` 存在且 `.migration-complete` 不存在时触发
- 原 JSON 文件备份为 `db.json.migrated`

### 缓存刷新

```typescript
// 清除看板缓存
const storage = await getStorage()
storage.clearCache()
```

### 调试 API

- `/api/debug/reset-db` - 重置数据库（开发环境）

---

## 设置系统

### 架构概述

应用设置现在以 **JSON 格式**存储在服务端本地文件 (`data/settings.json`)，替代原有的 localStorage 存储方式。

### 设置存储组件

| 组件 | 路径 | 职责 |
|------|------|------|
| `SettingsStorage` | `lib/storage/SettingsStorage.ts` | 服务端 JSON 文件读写 |
| `useSettings` | `lib/hooks/useSettings.ts` | 前端设置管理 Hook |
| 类型定义 | `types/settings.types.ts` | 设置类型定义 |

### 设置结构

```typescript
interface AppSettings {
  version: number
  ai: {
    defaultModel: 'deepseek-chat' | 'deepseek-reasoner'
    toolTrigger: {
      gateByPrefix: boolean
      showQuickTemplatesInChat: boolean
      showAssistantActionsInChat: boolean
      prefixes: { all: string; card: string; lane: string; board: string }
    }
    commands: AiCommand[]
  }
  boardView: {
    defaultBoardId?: string
    cardDensity: 'compact' | 'normal' | 'comfortable'
    showCardDescription: boolean
    showTagColors: boolean
  }
  updatedAt: string
}
```

### 设置 API 路由

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/settings` | GET | 获取完整设置 |
| `/api/settings` | PUT | 更新设置 |
| `/api/settings` | DELETE | 重置为默认 |
| `/api/settings/ai` | GET | 获取 AI 设置 |
| `/api/settings/ai` | PUT | 更新 AI 设置 |
| `/api/settings/ai/commands` | GET | 获取 AI 命令 |
| `/api/settings/ai/commands` | PUT | 更新 AI 命令 |
| `/api/settings/ai/tool-trigger` | GET | 获取工具触发配置 |
| `/api/settings/ai/tool-trigger` | PUT | 更新工具触发配置 |

### 前端使用示例

```typescript
// 使用设置 Hook
import { useSettings, useAiSettings, useAiCommands, useToolTriggerConfig } from '@/lib/hooks/useSettings'

// 获取完整设置
const { settings, loading, updateSettings } = useSettings()

// 仅获取 AI 设置
const { aiSettings, updateAiSettings } = useAiSettings()

// 获取/更新 AI 命令
const { commands, updateCommands } = useAiCommands()

// 获取/更新工具触发配置
const { config, updateConfig } = useToolTriggerConfig()
```

### 迁移说明

- 原 localStorage 存储 (`kanban.aiCommands.v1`, `kanban.aiToolTriggerConfig.v1`) 已弃用
- 首次启动时自动创建默认设置文件
- 设置文件路径：`data/settings.json`

---

## 相关文档

| 文档 | 路径 |
|------|------|
| 项目索引 | `docs/index.md` |
| AI 工具系统 | `docs/ai-tools-system.md` |
| AI 工具指南 | `docs/ai-tools-guide.md` |
| API 路由文档 | `docs/api-routes.md` |
| 组件文档 | `docs/components.md` |
| 数据库文档 | `docs/database.md` |
| Claude 专用指南 | `CLAUDE.md` |

---

*最后更新: 2025-02-13*
