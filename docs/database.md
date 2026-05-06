# Database 数据库层文档

本文档详细说明 kanban-board 项目的数据存储架构和操作。

---

## 概述

kanban-board 使用 **Markdown 文件**作为数据持久化方案，替代了原有的 lowdb JSON 存储。

**文件位置**: `data/{board-id}.md`

**特点**:
- 人类可读，可用任何 Markdown 编辑器打开
- Git 版本控制友好（diff 可读）
- 兼具结构化数据（YAML frontmatter）和富文本内容（Markdown body）
- 单文件独立存储每个看板，天然支持按看板隔离
- 自动从 JSON 迁移（一次性）

---

## 数据模型

### 存储格式

每个看板存储为一个独立的 `.md` 文件，格式如下：

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
        description: 卡片描述
        position: 0
        tags:
          - id: tag-0
            name: 紧急
            color: '#ef4444'
        createdAt: '2024-01-01T00:00:00.000Z'
        updatedAt: '2024-01-01T00:00:00.000Z'
    createdAt: '2024-01-01T00:00:00.000Z'
    updatedAt: '2024-01-01T00:00:00.000Z'
createdAt: '2024-01-01T00:00:00.000Z'
updatedAt: '2024-01-01T00:00:00.000Z'
---

## 待办

### 示例卡片

卡片描述
```

### 类型定义

```typescript
// 标签
interface Tag {
  id: string          // 标签 ID
  name: string        // 标签名称
  color: string       // 十六进制颜色
}

// 卡片
interface Card {
  id: string                    // 卡片 ID
  laneId: string               // 所属列表 ID
  title: string                // 卡片标题
  description?: string         // 卡片描述（可选）
  position: number             // 排序位置
  tags?: Tag[]                 // 关联标签（可选）
  createdAt: string            // 创建时间 (ISO 8601)
  updatedAt: string            // 更新时间 (ISO 8601)
}

// 列表
interface Lane {
  id: string                    // 列表 ID
  boardId: string               // 所属看板 ID
  title: string                // 列表标题
  position: number             // 排序位置
  cards: Card[]                 // 卡片数组
  createdAt: string            // 创建时间
  updatedAt: string            // 更新时间
}

// 看板
interface Board {
  id: string                    // 看板 ID
  title: string                // 看板标题
  lanes: Lane[]                 // 列表数组
  tags?: Tag[]                  // 看板级预设标签池
  createdAt: string            // 创建时间
  updatedAt: string            // 更新时间
}
```

---

## 存储组件

| 组件 | 路径 | 职责 |
|------|------|------|
| `StorageAdapter` | `lib/storage/StorageAdapter.ts` | 主存储类，实现 dbHelpers 兼容接口 |
| `MarkdownBoard` | `lib/storage/MarkdownBoard.ts` | Markdown 文件读写操作 |
| `BoardCache` | `lib/storage/BoardCache.ts` | 内存缓存，减少文件 I/O |
| `FileLock` | `lib/storage/FileLock.ts` | 文件锁，防止并发写入冲突 |
| `SettingsStorage` | `lib/storage/SettingsStorage.ts` | 应用设置 JSON 文件存储 |

---

## 缓存策略

- **读缓存**: `getBoard()` 优先从 `BoardCache` 读取，未命中时读取文件并回写缓存
- **写缓存**: 每次写操作后更新缓存（非删除），保持缓存热数据
- **TTL**: 默认 5 分钟
- **索引**: `getBoards()` 优先从 `data/_boards.json` 索引文件读取，避免解析全部 Markdown

---

## 设置存储

应用设置以 JSON 格式存储在 `data/settings.json`，包含：
- AI 设置（默认模型、工具触发配置、命令）
- 看板视图设置（默认看板、卡片密度、显示选项）
- 全局标签

---

## 迁移说明

从 JSON 到 Markdown 的迁移是自动的：
- 检测 `data/db.json` 存在且 `.migration-complete` 不存在时触发
- 原 JSON 文件备份为 `db.json.migrated`
- 迁移标记文件 `.migration-complete` 防止重复迁移
