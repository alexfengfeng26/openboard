# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 **Next.js 16**、**React 19** 和 **lowdb** 架建的现代化看板系统（Kanban Board），支持多看板管理、拖放排序和 AI 集成功能。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16 | App Router |
| React | 19 | UI 框架 |
| Tailwind CSS | v4 | 样式系统 |
| Radix UI | Latest | 组件库 |
| lowdb | 2.x | JSON 数据持久化 |
| TypeScript | 5.0+ | 类型安全 |
| @dnd-kit | latest | 拖放功能 |
| lucide-react | latest | 图标库 |
| DeepSeek API | - | AI 提供商 |

## 开发命令

```bash
# 开发服务器
pnpm dev

# 生产构建
pnpm build

# 代码检查
pnpm lint

# 运行测试（如需要）
pnpm test
```

## 项目架构

### 核心目录结构

```
app/                      # Next.js App Router
├── api/                # API 路由
│   ├── ai/              # AI 相关 API
│   │   ├── chat/         # DeepSeek 聊天 API
│   │   └── tools/        # AI 工具执行 API
├── layout.tsx          # 根布局组件
├── page.tsx             # 主页面（服务端组件）
├── globals.css          # 全局样式
└── favicon.ico          # 网站图标

components/               # React 客户端组件
├── board/              # 看板相关组件
│   ├── BoardClient.tsx    # 主看板组件（拖放逻辑）
│   ├── BoardClientNoSSR.tsx  # 防水合包装器
│   ├── BoardSelector.tsx    # 看板选择器
│   ├── CreateBoardDialog.tsx  # 创建看板对话框
│   └── EditBoardDialog.tsx    # 编辑看板对话框
├── card/               # 卡片相关组件
│   ├── CardItem.tsx       # 卡片展示组件
│   ├── DraggableCard.tsx  # 可拖放卡片包装器
│   ├── CreateCardDialog.tsx  # 创建卡片对话框
│   ├── EditCardDialog.tsx    # 编辑卡片对话框
│   ├── CardFormDialog.tsx    # 统一的卡片表单对话框
│   └── TagSelector.tsx     # 标签选择器
├── lane/               # 列表相关组件
│   ├── LaneItem.tsx        # 列表容器（可拖放）
│   ├── CreateLaneDialog.tsx  # 创建列表对话框
│   └── EditLaneDialog.tsx    # 编辑列表对话框
├── ui/                 # Radix UI 组件封装
│   ├── ai/             # AI 相关组件
│   │   ├── DeepSeekChatPanel.tsx    # 主聊天面板
│   │   ├── ToolCallConfirmation.tsx  # 工具调用确认对话框
│   │   └── OperationLogPanel.tsx   # 操作日志面板
│   ├── alert-dialog.tsx   # 警告对话框
│   ├── badge.tsx       # 徽章组件
│   ├── button.tsx      # 按钮组件
│   ├── confirm-dialog.tsx  # 确认对话框
│   ├── dialog.tsx       # 对话框基础组件
│   ├── input.tsx        # 输入框组件
│   └── textarea.tsx     # 文本域组件
└── lib/                 # 核心库和工具
    ├── db.ts              # 数据库层（lowdb + 类型定义）
    ├── drag-utils.ts      # 拖放工具函数
    └── utils.ts           # 通用工具函数
```

### 数据模型

```typescript
// Board - 看板
{
  id: string
  title: string
  lanes: Lane[]
  tags?: Tag[]  // 看板级预设标签池
  createdAt: string
  updatedAt: string
}

// Lane - 列表
{
  id: string
  title: string
  cards: Card[]
  position: number
  createdAt: string
  updatedAt: string
}

// Card - 卡片
{
  id: string
  laneId: string
  title: string
  description?: string
  position: number
  createdAt: string
  updatedAt: string
  tags?: Tag[]  // 引用看板标签
}
```

### 功能特性

1. **多看板管理** - 支持创建、编辑、删除多个看板
2. **拖放排序** - 卡片和列表可自由拖放重排序
3. **AI 集成** - 通过 DeepSeek API 实现智能卡片创建
4. **实时更新** - 乐观更新 UI，失败时自动回滚
5. **操作日志** - 完整记录所有 AI 工具调用
6. **标签系统** - 支持为卡片添加自定义标签

### 关键设计模式

- **服务端/客户端分离**：API 路由在服务端，状态管理在客户端
- **单例模式**：`dbHelpers` 和 `toolRegistry` 使用单例模式
- **工具注册表**：所有 AI 工具集中注册在 `lib/ai-tools/tools/registry.ts`
- **类型安全**：使用 TypeScript strict mode，所有类型明确定义
- **可复用组件**：`CardFormDialog` 统一创建和编辑卡片表单

### 重要注意事项

1. **API Key 配置**：DeepSeek API Key 需配置在 `.env` 文件中（已排除版本控制）
2. **数据存储**：所有数据存储在 `data/db.json`，自动生成但请勿手动修改
3. **Hydration 预警**：`BoardClientNoSSR` 使用动态导入防止 SSR
4. **拖放架构**：使用 `@dnd-kit` 库，支持键盘操作
5. **错误处理**：使用 `sonner` toast 通知，替代 `alert()` 和 `console.error()`

### 常见任务

| 任务 | 说明 |
|------|------|
| 添加新功能 | 遵循现有组件模式，在 `components/` 创建新组件 |
| 修复 Bug | 优先处理影响用户体验的关键问题 |
| 重构代码 | 使用 `useReducer` 替代多个 `useState`，提升状态管理 |
| 优化 AI | 改进 Prompt 指令和响应解析，提高工具调用成功率 |
| 文档更新 | 保持 `docs/ai-tools-guide.md` 与代码同步 |

### 开发规范

- **代码风格**：遵循 ESLint 配置，使用 Prettier 格式化
- **提交规范**：清晰的 commit message，参考现有格式
- **测试先行**：新功能需编写测试用例
- **文档同步**：代码变更时同步更新相关文档

---

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 创建新的看板（示例）
# 访问 http://localhost:3000，点击右侧 Chat 面板与 AI 对话
# 尝试输入："创建一张卡片：优化登录功能"
```

## 联系与支持

如有问题或建议，请通过 GitHub Issues 联系。
