# 项目文档索引

kanban-board 项目文档入口。

---

## 文档目录

| 文档 | 描述 |
|------|------|
| [developer-guide.md](./developer-guide.md) | 开发指南：架构、存储、组件、API |
| [ai-system.md](./ai-system.md) | AI 工具系统：架构与使用手册 |
| [product-features.md](./product-features.md) | 产品功能说明 |

---

## 快速导航

- **开发者入门**：阅读 [developer-guide.md](./developer-guide.md)
- **使用 AI 功能**：阅读 [ai-system.md](./ai-system.md)

---

## 项目概述

**kanban-board** 是一个基于 **Next.js 16**、**React 19** 和 Markdown 文件存储构建的现代化看板系统。

**核心功能**：
- 多看板管理（支持归档/恢复）
- 卡片搜索与过滤
- 批量卡片操作（移动、删除、更新标签）
- 拖放排序（卡片与列表）
- AI 智能助手（DeepSeek）
- 标签系统与附件支持
- 键盘快捷键
- 响应式设计

**技术栈**：
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- @dnd-kit（拖放）
- Markdown 文件存储
- DeepSeek API

---

## 目录结构

```
kanban-board/
├── app/                  # Next.js App Router
├── components/           # React 客户端组件
├── lib/                  # 核心库（存储、AI、Hooks、验证）
├── types/                # TypeScript 类型定义
├── data/                 # 数据存储（*.md、settings.json）
└── docs/                 # 项目文档（本目录）
```

---

*最后更新: 2026-05-08*
