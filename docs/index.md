# 项目文档索引

kanban-board 项目的完整文档索引。

---

## 文档目录

| 文档 | 描述 |
|------|------|
| [architecture.md](./architecture.md) | 项目架构概述、技术栈、目录结构 |
| [api-routes.md](./api-routes.md) | API 路由完整文档 |
| [components.md](./components.md) | React 组件详细说明 |
| [ai-tools-system.md](./ai-tools-system.md) | AI 工具调用系统架构 |
| [ai-tools-guide.md](./ai-tools-guide.md) | AI 工具使用手册 |
| [database.md](./database.md) | 数据库层设计文档 |
| [codereview.md](./codereview.md) | 代码审查和问题清单 |

---

## 快速导航

### 新手入门
1. 阅读 [architecture.md](./architecture.md) 了解项目结构
2. 阅读 [ai-tools-guide.md](./ai-tools-guide.md) 学习使用 AI 功能

### 开发者参考
- **API 开发**: [api-routes.md](./api-routes.md)
- **组件开发**: [components.md](./components.md)
- **数据库操作**: [database.md](./database.md)
- **AI 扩展**: [ai-tools-system.md](./ai-tools-system.md)

### 代码维护
- **问题修复**: [codereview.md](./codereview.md)

---

## 项目概述

**kanban-board** 是一个基于 Next.js 16、React 19 和 lowdb 构建的现代化看板系统。

**核心功能**:
- 多看板管理
- 拖放排序
- AI 智能助手 (DeepSeek)
- 标签系统
- 响应式设计

**技术栈**:
- Next.js 16 (App Router)
- React 19
- TypeScript (strict mode)
- Tailwind CSS v4
- @dnd-kit (拖放)
- lowdb (数据持久化)
- DeepSeek API (AI)

---

## 目录结构概览

```
kanban-board/
├── app/                      # Next.js App Router
│   ├── api/                # API 路由
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 主页面
│   └── globals.css         # 全局样式
├── components/               # React 组件
│   ├── board/             # 看板组件
│   ├── lane/              # 列表组件
│   ├── card/              # 卡片组件
│   ├── ai/                # AI 组件
│   └── ui/                # UI 组件库
├── lib/                     # 核心库
│   ├── db.ts              # 数据库层
│   ├── drag-utils.ts      # 拖放工具
│   ├── reorder.ts         # 排序算法
│   └── ai-tools/          # AI 工具系统
├── types/                   # TypeScript 类型
├── data/                    # 数据存储
│   └── db.json          # lowdb 数据文件
└── docs/                    # 项目文档（本目录）
```

---

## 版本历史

### v1.0.0 (2025-02-12)
- 初始版本发布
- 完整的看板 CRUD 功能
- 拖放排序支持
- DeepSeek AI 集成
- 工具调用系统

---

## 许可证

[根据项目实际许可证填写]

---

## 贡献

欢迎提交 Issue 和 Pull Request！

---

## 联系方式

- GitHub: [项目地址]
- Issues: [问题反馈]

---

*最后更新: 2025-02-12*
