# Database 数据库层文档

本文档详细说明 kanban-board 项目的数据库设计和操作。

---

## 概述

kanban-board 使用 **lowdb 2.x** 作为数据持久化方案，将数据存储为 JSON 文件。

**文件位置**: `data/db.json`

**特点**:
- 轻量级，无需数据库服务器
- 易于调试和备份
- 适合小型项目和演示

---

## 数据模型

### 数据结构

```
Data
└── boards: Board[]
    ├── id: string
    ├── title: string
    ├── lanes: Lane[]
    │   ├── id: string
    │   ├── boardId: string
    │   ├── title: string
    │   ├── position: number
    │   ├── cards: Card[]
    │   │   ├── id: string
    │   │   ├── laneId: string
    │   │   ├── title: string
    │   │   ├── description?: string
    │   │   ├── position: number
    │   │   ├── tags?: Tag[]
    │   │   ├── createdAt: string
    │   │   └── updatedAt: string
    │   ├── createdAt: string
    │   └── updatedAt: string
    ├── tags?: Tag[]      (看板级预设标签)
    │   ├── id: string
    │   ├── name: string
    │   └── color: string
    ├── createdAt: string
    └── updatedAt: string
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
  id: string                    // 卡片 ID，格式：card-{timestamp}
  laneId: string               // 所属列表 ID
  title: string                // 卡片标题
  description?: string         // 卡片描述（可选）
  position: number             // 排序位置
  tags?: Tag[]               // 关联标签（可选）
  createdAt: string           // 创建时间 (ISO 8601)
  updatedAt: string           // 更新时间 (ISO 8601)
}

// 列表
interface Lane {
  id: string                    // 列表 ID，格式：lane-{timestamp}-{index}
  boardId: string               // 所属看板 ID
  title: string                // 列表标题
  position: number             // 排序位置
  cards: Card[]               // 包含的卡片
  createdAt: string           // 创建时间
  updatedAt: string           // 更新时间
}

// 看板
interface Board {
  id: string                    // 看板 ID，格式：board-{timestamp}
  title: string                // 看板标题
  lanes: Lane[]               // 包含的列表
  tags?: Tag[]               // 预设标签池（可选）
  createdAt: string           // 创建时间
  updatedAt: string           // 更新时间
}

// 根数据
interface Data {
  boards: Board[]             // 所有看板
}
```

### 设计要点

**嵌套结构**:
- `Board` 包含 `Lane[]`
- `Lane` 包含 `Card[]`
- 便于一次查询获取完整看板数据

**位置排序**:
- 所有实体都有 `position` 字段
- 使用浮点数支持中间值插入
- 避免频繁的全量位置重计算

**标签设计**:
- `Board.tags` 是看板级预设标签池
- `Card.tags` 引用看板标签，存储完整对象
- 每个看板有独立的标签系统

**时间戳**:
- 所有实体都有 `createdAt` 和 `updatedAt`
- 使用 ISO 8601 格式字符串
- 每次更新自动更新 `updatedAt`

---

## 默认数据

### 预设看板

数据库初始化时创建 3 个示例看板：

#### 1. 我的看板 (default-board)

```typescript
{
  id: 'default-board',
  title: '我的看板',
  lanes: [
    { id: 'lane-todo', title: '待办', position: 0, cards: [...] },
    { id: 'lane-inprogress', title: '进行中', position: 1, cards: [...] },
    { id: 'lane-done', title: '已完成', position: 2, cards: [...] }
  ]
}
```

#### 2. Scrum 敏捷开发 (board-scrum)

```typescript
{
  id: 'board-scrum',
  title: 'Scrum 敏捷开发',
  lanes: [
    { id: 'scrum-backlog', title: 'Backlog', position: 0 },
    { id: 'scrum-sprint', title: 'Sprint', position: 1 },
    { id: 'scrum-review', title: 'Review', position: 2 },
    { id: 'scrum-done', title: 'Done', position: 3 }
  ]
}
```

#### 3. Bug 跟踪 (board-bug)

```typescript
{
  id: 'board-bug',
  title: 'Bug 跟踪',
  lanes: [
    { id: 'bug-reported', title: '已报告', position: 0 },
    { id: 'bug-fixing', title: '修复中', position: 1 },
    { id: 'bug-testing', title: '待验证', position: 2 },
    { id: 'bug-closed', title: '已关闭', position: 3 }
  ]
}
```

### 预设标签颜色

```typescript
export const TAG_COLORS = [
  { name: '紧急', color: '#ef4444' },    // 红色
  { name: '功能', color: '#3b82f6' },    // 蓝色
  { name: 'Bug', color: '#f59e0b' },     // 橙色
  { name: '优化', color: '#10b981' },    // 绿色
  { name: '文档', color: '#8b5cf6' },    // 紫色
  { name: '设计', color: '#ec4899' },    // 粉色
]
```

---

## 数据库实例

### 单例模式

```typescript
// 私有实例
let dbInstance: Low<Data> | null = null

// 获取实例（懒加载）
export async function getDb() {
  if (!dbInstance) {
    dbInstance = await createDb()
  }
  return dbInstance
}
```

### 创建流程

```typescript
async function createDb() {
  const db = new Low<Data>(new JSONFile<Data>(dbFilePath), defaultData)
  await db.read()

  // 如果数据为空，使用默认数据
  if (!db.data || !db.data.boards || db.data.boards.length === 0) {
    db.data = defaultData
    await db.write()
  }

  return db
}
```

### 重置（开发环境）

```typescript
export async function resetDb() {
  dbInstance = null  // 清除实例缓存
}
```

---

## 数据库操作 (dbHelpers)

### 看板操作

#### getBoards()

获取所有看板列表（轻量级）

```typescript
async getBoards(): Promise<Array<{
  id: string
  title: string
  createdAt: string
  updatedAt: string
}>>
```

**特点**: 只返回 ID、标题、时间，不包含 lanes 和 cards

---

#### getBoard(boardId)

根据 ID 获取完整看板

```typescript
async getBoard(boardId: string): Promise<Board | null>
```

---

#### createBoard(title)

创建新看板

```typescript
async createBoard(title: string): Promise<Board>
```

**自动创建**: 3 个默认列表（待办、进行中、已完成）
**自动生成**: 6 个预设标签

---

#### updateBoard(boardId, data)

更新看板

```typescript
async updateBoard(boardId: string, data: { title?: string }): Promise<Board | null>
```

---

#### deleteBoard(boardId)

删除看板（至少保留一个）

```typescript
async deleteBoard(boardId: string): Promise<boolean>
```

**限制**: 系统至少保留一个看板

---

### 卡片操作

#### createCard(boardId, laneId, title, description, tags)

创建卡片

```typescript
async createCard(
  boardId: string,
  laneId: string,
  title: string,
  description?: string,
  tags?: Tag[]
): Promise<Card>
```

**ID 格式**: `card-{Date.now()}`

---

#### updateCard(boardId, cardId, data)

更新卡片

```typescript
async updateCard(
  boardId: string,
  cardId: string,
  data: Partial<Card>
): Promise<void>
```

**可更新字段**: title、description、tags

---

#### deleteCard(boardId, cardId)

删除卡片

```typescript
async deleteCard(boardId: string, cardId: string): Promise<void>
```

---

#### moveCard(boardId, cardId, toLaneId, newPosition)

移动卡片到其他列表

```typescript
async moveCard(
  boardId: string,
  cardId: string,
  toLaneId: string,
  newPosition: number
): Promise<void>
```

**逻辑**:
1. 从源列表移除卡片
2. 更新 card.laneId
3. 添加到目标列表末尾（或指定位置）

**注意**: 当前实现中 boardId 参数未充分利用

---

### 列表操作

#### createLane(boardId, title)

创建列表

```typescript
async createLane(boardId: string, title: string): Promise<Lane>
```

**ID 格式**: `lane-{Date.now()}`

---

#### updateLane(boardId, laneId, data)

更新列表

```typescript
async updateLane(
  boardId: string,
  laneId: string,
  data: Partial<Lane>
): Promise<void>
```

---

#### deleteLane(boardId, laneId)

删除列表

```typescript
async deleteLane(boardId: string, laneId: string): Promise<void>
```

---

### 标签操作

#### getTags(boardId?)

获取看板预设标签

```typescript
async getTags(boardId?: string): Promise<Tag[]>
```

**默认**: 返回 `default-board` 的标签或使用预设颜色

---

## 位置排序算法

### 中间值插入法

**文件**: `lib/reorder.ts`

```typescript
function calculateInsertPosition(
  beforeItem: { position: number } | null,
  afterItem: { position: number } | null
): number | null
```

**逻辑**:
1. 两项之间 → 取平均值
2. 列表开头 → afterItem.position - 1000
3. 列表末尾 → beforeItem.position + 1000
4. 空列表 → 默认 1000

**间隙不足**: 返回 `null`，触发标准化

---

### 标准化位置

```typescript
function normalizePositions<T>(
  items: T[],
  startPosition = 0,
  increment = 1000
): T[]
```

**用途**: 当中间值不足时，重新计算所有位置

**示例**:
```
原: [0, 500, 1000, 1500]  (间隙不足)
新: [0, 1000, 2000, 3000]  (标准化)
```

---

## 数据文件示例

`data/db.json`:

```json
{
  "boards": [
    {
      "id": "default-board",
      "title": "我的看板",
      "createdAt": "2025-02-12T00:00:00.000Z",
      "updatedAt": "2025-02-12T00:00:00.000Z",
      "tags": [
        { "id": "tag-0", "name": "紧急", "color": "#ef4444" },
        { "id": "tag-1", "name": "功能", "color": "#3b82f6" }
      ],
      "lanes": [
        {
          "id": "lane-todo",
          "boardId": "default-board",
          "title": "待办",
          "position": 0,
          "createdAt": "2025-02-12T00:00:00.000Z",
          "updatedAt": "2025-02-12T00:00:00.000Z",
          "cards": [
            {
              "id": "card-1234567890",
              "laneId": "lane-todo",
              "title": "示例卡片",
              "description": "这是一个示例",
              "position": 0,
              "tags": [{ "id": "tag-0", "name": "紧急", "color": "#ef4444" }],
              "createdAt": "2025-02-12T00:00:00.000Z",
              "updatedAt": "2025-02-12T00:00:00.000Z"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 注意事项

### 已知问题

1. **硬编码 boardId**:
   - `moveCard`、`createCard` 部分函数内仍隐式使用 `'default-board'`
   - 新函数应显式接受 `boardId` 参数

2. **缺少事务**:
   - 复杂操作无回滚机制
   - 失败可能导致数据不一致

3. **并发控制**:
   - 无写入锁机制
   - 多请求同时写入可能冲突

4. **数据验证**:
   - 参数校验不完整
   - 建议添加 schema 验证

### 性能考虑

1. **全量读写**:
   - 每次操作都写入整个 JSON 文件
   - 适合小型数据集
   - 大规模时应考虑数据库升级

2. **嵌套查询**:
   - 查找卡片需遍历所有列表
   - 可优化为建立索引映射

---

## 相关文档

- [API Routes](./api-routes.md)
- [组件文档](./components.md)
- [AI 工具系统](./ai-tools-system.md)
- [架构概述](./architecture.md)
