# API Routes 文档

本文档详细说明 kanban-board 项目的所有 API 路由。

---

## 目录结构

```
app/api/
├── boards/
│   ├── route.ts              # GET/POST - 获取所有看板/创建看板
│   └── [boardId]/
│       └── route.ts          # GET/PATCH/DELETE - 看板详情/更新/删除
├── cards/
│   ├── route.ts              # POST/PATCH/DELETE - 卡片 CRUD
│   ├── move/route.ts         # POST - 移动卡片
│   └── reorder/route.ts      # POST - 重排卡片顺序
├── lanes/
│   ├── route.ts              # POST - 创建列表
│   └── reorder/route.ts      # POST - 重排列表顺序
├── tags/route.ts            # POST - 创建标签
├── ai/
│   ├── chat/route.ts        # POST - DeepSeek AI 聊天
│   └── tools/
│       └── execute/route.ts  # POST - 执行 AI 工具调用
└── debug/
    └── reset-db/route.ts     # POST - 重置数据库（开发用）
```

---

## 通用响应格式

### 成功响应

```typescript
{
  success: true,
  data: T     // 返回的数据
}
```

### 错误响应

```typescript
{
  success: false,
  error: string    // 错误信息
}
// 或
{
  error: string    // 某些接口使用此格式
}
```

---

## 看板 API

### 1. 获取所有看板

**接口**: `GET /api/boards`

**响应**:
```typescript
{
  success: true,
  data: Array<{
    id: string
    title: string
    createdAt: string
    updatedAt: string
  }>
}
```

**说明**: 返回所有看板的轻量级信息（不包含 lanes 和 cards）

---

### 2. 创建看板

**接口**: `POST /api/boards`

**请求体**:
```typescript
{
  title: string    // 看板标题
}
```

**响应**:
```typescript
{
  success: true,
  data: Board     // 完整的看板对象（包含 lanes 和 cards）
}
```

**状态码**: 201 Created

---

### 3. 获取看板详情

**接口**: `GET /api/boards/[boardId]`

**参数**: `boardId` - 看板 ID

**响应**:
```typescript
{
  success: true,
  data: Board     // 完整的看板对象
}
```

---

### 4. 更新看板

**接口**: `PATCH /api/boards/[boardId]`

**参数**: `boardId` - 看板 ID

**请求体**:
```typescript
{
  title?: string
  description?: string
  tags?: Tag[]
}
```

**响应**:
```typescript
{
  success: true,
  data: Board     // 更新后的看板
}
```

---

### 5. 删除看板

**接口**: `DELETE /api/boards/[boardId]`

**参数**: `boardId` - 看板 ID

**限制**: 至少保留一个看板

**响应**:
```typescript
{
  success: true
}
```

---

## 卡片 API

### 1. 创建卡片

**接口**: `POST /api/cards`

**请求体**:
```typescript
{
  boardId: string
  laneId: string
  title: string
  description?: string
  tags?: Tag[]
}
```

**响应**:
```typescript
{
  success: true,
  data: Card
}
```

---

### 2. 更新卡片

**接口**: `PATCH /api/cards`

**请求体**:
```typescript
{
  cardId?: string           // 可选，优先使用 body 中的
  boardId?: string         // 可选
  title?: string
  description?: string
  tags?: Tag[]
}
```

**查询参数**: `cardId` 或 `id` - 卡片 ID

**响应**:
```typescript
{
  success: true
}
```

---

### 3. 删除卡片

**接口**: `DELETE /api/cards`

**查询参数**:
- `id` 或 `cardId` - 卡片 ID
- `boardId` - 看板 ID

**响应**:
```typescript
{
  success: true
}
```

---

### 4. 移动卡片

**接口**: `POST /api/cards/move`

**请求体**:
```typescript
{
  boardId: string
  cardId: string
  toLaneId: string
  newPosition: number    // 目标位置
}
```

**响应**:
```typescript
{
  success: true,
  data: Card     // 移动后的卡片
}
```

**说明**: 将卡片从一个列表移动到另一个列表的指定位置

---

### 5. 重排卡片

**接口**: `POST /api/cards/reorder`

**请求体**:
```typescript
{
  boardId: string
  laneId: string
  cardIds: string[]    // 按新顺序排列的卡片 ID 数组
}
```

**响应**:
```typescript
{
  success: true
}
```

**说明**: 同一列表内重新排序卡片

---

## 列表 (Lane) API

### 1. 创建列表

**接口**: `POST /api/lanes`

**请求体**:
```typescript
{
  boardId: string
  title: string
}
```

**响应**:
```typescript
{
  success: true,
  data: Lane
}
```

---

### 2. 更新列表

**接口**: `PATCH /api/lanes`

**请求体**:
```typescript
{
  laneId: string
  boardId: string
  title?: string
}
```

**响应**:
```typescript
{
  success: true,
  data: Lane
}
```

---

### 3. 删除列表

**接口**: `DELETE /api/lanes`

**查询参数**:
- `laneId` - 列表 ID
- `boardId` - 看板 ID

**响应**:
```typescript
{
  success: true
}
```

---

### 4. 重排列表

**接口**: `POST /api/lanes/reorder`

**请求体**:
```typescript
{
  boardId: string
  laneIds: string[]    // 按新顺序排列的列表 ID 数组
}
```

**响应**:
```typescript
{
  success: true
}
```

---

## 标签 (Tags) API

### 1. 创建标签

**接口**: `POST /api/tags`

**请求体**:
```typescript
{
  boardId: string
  tags: Tag[]
}
```

**说明**: 向看板添加预设标签

---

## AI 工具 API

### 1. AI 聊天

**接口**: `POST /api/ai/chat`

**请求体**:
```typescript
{
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model?: string    // 默认 'deepseek-chat'
  stream?: boolean
}
```

**响应**:
```typescript
{
  content: string    // AI 响应内容
}
```

**说明**: 调用 DeepSeek API 进行对话

---

### 2. 执行工具调用

**接口**: `POST /api/ai/tools/execute`

**请求体**:
```typescript
{
  toolCalls?: ToolCallRequest[]     // 首选格式
  tool_calls?: ToolCallRequest[]    // 兼容格式
}

interface ToolCallRequest {
  toolName: string
  params: Record<string, unknown>
}
```

**响应**:
```typescript
{
  success: true,
  data: ToolExecutionResult[]
}

interface ToolExecutionResult {
  toolName: string
  success: boolean
  data?: unknown
  error?: string
}
```

**运行时**: `nodejs`（服务端执行）

---

## 调试 API

### 1. 重置数据库

**接口**: `POST /api/debug/reset-db`

**说明**: 恢复数据库到默认状态（仅开发环境）

**响应**:
```typescript
{
  success: true,
  message: string
}
```

---

## 错误处理

所有 API 路由遵循以下错误处理模式：

```typescript
try {
  // 业务逻辑
} catch (error) {
  console.error('[API Route Name] Error:', error)
  return NextResponse.json(
    { success: false, error: 'User-friendly message' },
    { status: 500 }
  )
}
```

---

## 注意事项

1. **boardId 参数**: 大部分操作需要 `boardId`，用于定位数据
2. **位置计算**: 卡片位置使用浮点数，支持中间值插入
3. **乐观更新**: 客户端应先更新 UI，失败时回滚
4. **类型安全**: 建议使用 TypeScript 类型定义进行请求/响应验证
5. **错误响应格式**: 部分接口使用不统一的错误格式（待修复）

---

## 相关文档

- [数据库层文档](./database.md)
- [类型定义](../types/index.ts)
- [AI 工具系统](./ai-tools-system.md)
