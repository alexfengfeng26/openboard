# Architecture 架构文档

本文档概述 kanban-board 项目的整体架构。

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.1.6 | App Router、服务端渲染 |
| React | 19.2.3 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
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
├── app/                  # Next.js App Router（服务端组件）
│   ├── api/             # API 路由
│   ├── layout.tsx       # 根布局
│   ├── page.tsx         # 主页面
│   └── globals.css      # 全局样式
├── components/          # React 客户端组件
│   ├── ai/             # AI 聊天、操作日志、设置对话框
│   ├── board/          # 看板、看板选择器、拖放容器
│   ├── card/           # 卡片、可拖放卡片、标签选择器
│   ├── lane/           # 列表、快速创建
│   └── ui/             # UI 基础组件（shadcn/ui）
├── lib/                 # 核心库
│   ├── ai/             # AI 命令解析、卡片草稿解析
│   ├── ai-tools/       # 工具系统（注册表、执行器、Prompt 构建）
│   ├── hooks/          # 自定义 Hooks（设置、聊天消息、操作日志）
│   ├── storage/        # 存储层（Markdown 文件、缓存、文件锁）
│   ├── db.ts           # dbHelpers 兼容层
│   └── utils.ts        # 通用工具
├── types/               # TypeScript 类型定义
├── data/                # 数据存储目录（Markdown 文件、设置 JSON）
└── docs/                # 项目文档
```

---

## 数据流

```
用户操作 → React 组件 → API 路由 → StorageAdapter → MarkdownBoard
                                      ↓
                                   BoardCache
                                      ↓
                                data/*.md
```

---

## AI 工具系统

```
用户输入 → DeepSeekChatPanel → /api/ai/chat → DeepSeek API
                                          ↓
                                   返回工具调用 JSON
                                          ↓
                                   /api/ai/tools/execute
                                          ↓
                                   ServerToolExecutor → 工具执行 → 更新数据
```

---

## 关键设计决策

1. **Markdown 文件存储**: 替代 JSON 数据库，兼顾人类可读性和结构化数据
2. **内存缓存**: `BoardCache` 减少高频操作时的文件 I/O
3. **文件锁**: `FileLock` 防止并发写入冲突
4. **乐观更新**: 前端先更新 UI，API 成功后再确认，失败时自动回滚
5. **服务端组件优先**: 数据获取在服务端完成，减少客户端 JavaScript
