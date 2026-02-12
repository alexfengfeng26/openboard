# AI Tools System 文档

本文档详细说明 kanban-board 项目的 AI 工具调用系统的架构和实现。

---

## 目录结构

```
lib/ai-tools/
├── index.ts                    # 模块导出入口
├── server-executor.ts           # 服务端工具执行器
├── prompt/
│   └── builder.ts             # Prompt 构建器
├── parser/
│   ├── tool-call-parser.ts     # 工具调用解析器
│   ├── card-draft-types.ts    # 卡片草稿类型
│   └── fallback-tool-parser.ts # 降级解析器
└── tools/
    ├── base.ts                # 工具基类
    ├── registry.ts            # 工具注册表（单例）
    ├── card-tools.ts          # 卡片工具定义
    ├── lane-tools.ts          # 列表工具定义
    └── board-tools.ts        # 看板工具定义
```

---

## 系统架构

### 整体流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户界面层                              │
│  DeepSeekChatPanel - 用户输入自然语言指令                     │
└────────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Prompt 构建层                            │
│  PromptBuilder.buildToolSystemPrompt(context)                    │
│  - 构建系统提示词                                            │
│  - 包含工具定义                                               │
│  - 注入上下文信息（看板、列表）                                │
└────────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AI 服务层                               │
│  POST /api/ai/chat                                          │
│  - 调用 DeepSeek API                                         │
│  - 返回 JSON 格式工具调用                                     │
└────────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      解析层                                  │
│  ToolCallParser.parse(aiResponse)                             │
│  - 解析工具调用 JSON                                         │
│  - 提取 tool_calls 数组                                       │
│  - 验证格式正确性                                             │
└────────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     用户确认层                                 │
│  ToolCallConfirmation                                        │
│  - 显示待执行的工具调用                                         │
│  - 用户确认后执行                                              │
└────────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    执行层（服务端）                              │
│  POST /api/ai/tools/execute                                 │
│  ServerToolExecutor.execute(toolCall)                           │
│  - 调用 dbHelpers 执行数据库操作                                 │
│  - 返回执行结果                                                │
└────────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      日志层                                  │
│  OperationLogPanel                                           │
│  - 记录所有工具调用                                            │
│  - 显示执行结果                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 核心模块详解

### 1. 工具定义 (tools/)

#### BaseTool 基类

**文件**: `lib/ai-tools/tools/base.ts`

**功能**: 所有工具的抽象基类

```typescript
export abstract class BaseTool implements ToolDefinition {
  abstract name: string                      // 工具名称
  abstract description: string               // 工具描述
  abstract category: 'board' | 'lane' | 'card'  // 工具分类
  abstract paramSchema: ToolParameterSchema[]  // 参数模式

  // 生成 Prompt 用的工具描述
  getPromptDescription(): string { ... }

  // 验证参数
  validateParams(params): { valid: boolean; error?: string } { ... }

  // 执行工具（子类实现）
  abstract execute(params): Promise<ToolExecutionResult>
}
```

**参数模式**:
```typescript
interface ToolParameterSchema {
  name: string        // 参数名
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean   // 是否必填
  description: string // 参数描述
  enum?: string[]   // 枚举值（可选）
}
```

---

#### 工具注册表 (registry.ts)

**文件**: `lib/ai-tools/tools/registry.ts`

**功能**: 单例模式管理所有工具

```typescript
class ToolRegistry {
  private tools: Map<string, BaseTool>

  constructor() {
    // 自动注册所有工具
    this.register(new CreateCardTool())
    this.register(new UpdateCardTool())
    this.register(new MoveCardTool())
    this.register(new DeleteCardTool())
    this.register(new CreateLaneTool())
    this.register(new DeleteLaneTool())
    this.register(new UpdateLaneTool())
    this.register(new CreateBoardTool())
    this.register(new DeleteBoardTool())
    this.register(new UpdateBoardTool())
  }

  get(name: string): BaseTool | undefined
  getAll(): BaseTool[]
  getByCategory(category): BaseTool[]
}

// 单例导出
export const toolRegistry = new ToolRegistry()
```

**已注册工具**:

| 分类 | 工具名 | 功能 |
|------|---------|------|
| card | create_card | 创建卡片 |
| card | update_card | 更新卡片 |
| card | move_card | 移动卡片 |
| card | delete_card | 删除卡片 |
| lane | create_lane | 创建列表 |
| lane | update_lane | 更新列表 |
| lane | delete_lane | 删除列表 |
| board | create_board | 创建看板 |
| board | update_board | 更新看板 |
| board | delete_board | 删除看板 |

---

### 2. Prompt 构建器 (prompt/)

**文件**: `lib/ai-tools/prompt/builder.ts`

**功能**: 构建包含工具定义的系统提示词

```typescript
class PromptBuilder {
  static buildToolSystemPrompt(context: PromptContext): string {
    const tools = toolRegistry.getAll()
    const toolDescriptions = tools.map(t => t.getPromptDescription()).join('\n\n')
    const contextInfo = this.buildContextInfo(context)

    return `
你是一个看板管理助手，可以帮助用户操作看板、列表和卡片。

## 当前上下文
${contextInfo}

## 可用工具
${toolDescriptions}

## 工具调用格式
当用户请求执行操作时，请按以下 JSON 格式返回工具调用：
...

## 创建卡片指引
...
    `.trim()
  }
}
```

**上下文信息**:
```typescript
interface PromptContext {
  currentBoard?: { id: string; title: string }
  currentLanes?: Array<{ id: string; title: string; cardCount: number }>
}
```

**示例 Prompt 输出**:
```
你是一个看板管理助手，可以帮助用户操作看板、列表和卡片。

## 当前上下文
当前看板: 我的看板 (ID: default-board)
当前列表:
  - 待办 (ID: lane-1, 卡片数: 3)
  - 进行中 (ID: lane-2, 卡片数: 2)
  - 已完成 (ID: lane-3, 卡片数: 1)

## 可用工具
工具名: create_card
描述: 在指定列表中创建新卡片
参数:
  - boardId[必填]: 看板 ID
  - laneId[必填]: 目标列表 ID
  - title[必填]: 卡片标题
  - description[可选]: 卡片详细描述
...
```

---

### 3. 工具调用解析器 (parser/)

**文件**: `lib/ai-tools/parser/tool-call-parser.ts`

**功能**: 从 AI 返回的文本中解析工具调用

```typescript
class ToolCallParser {
  static parse(aiResponse: string): ToolCallRequest[] | null {
    // 尝试1: 直接解析 JSON
    const directParsed = this.tryParseJson(aiResponse)
    if (directParsed) return directParsed

    // 尝试2: 提取代码块中的 JSON
    const codeBlockParsed = this.tryParseCodeBlock(aiResponse)
    if (codeBlockParsed) return codeBlockParsed

    // 尝试3: 从文本中提取第一个 JSON 对象
    const embeddedParsed = this.tryParseEmbeddedObject(aiResponse)
    if (embeddedParsed) return embeddedParsed

    return null
  }
}
```

**支持格式**:
1. 纯 JSON: `{"tool_calls": [...]}`
2. Markdown 代码块: ` ```json ... ``` `
3. 嵌入文本的 JSON: 提取第一个完整对象

**平衡括号提取**: `extractBalancedObjectSlice`
- 处理字符串内的括号
- 处理转义字符
- 精确提取完整 JSON 对象

---

**降级解析器 (fallback-tool-parser.ts)**

**文件**: `lib/ai-tools/parser/fallback-tool-parser.ts`

**功能**: 当 AI 未返回标准工具调用时，尝试从文本中提取卡片草稿

```typescript
class FallbackToolParser {
  static setDefaultLaneId(laneId: string)  // 设置默认列表 ID

  static parse(text: string):
    | { type: 'tool_calls'; data: ToolCallRequest[] }
    | { type: 'draft'; data: CardDraft[] }
    | { type: 'none'; data: [] }
}
```

**提取模式**:
- `创建一张卡片：标题` → 直接创建
- `待办：标题` → 创建卡片
- `在XXX列表创建：标题` → 指定列表创建
- `标题：XXX 描述：YYY` → 带描述的卡片
- 表格格式（`| 标题 | 描述 |`）→ 批量创建

---

### 4. 服务端执行器 (server-executor.ts)

**文件**: `lib/ai-tools/server-executor.ts`

**功能**: 在服务端执行工具调用，调用 dbHelpers

```typescript
class ServerToolExecutor {
  static async execute(toolCall: ToolCallRequest): Promise<ToolExecutionResult> {
    const { toolName, params } = toolCall

    try {
      switch (toolName) {
        case 'create_card': {
          const { boardId, laneId, title, description } = params
          const card = await dbHelpers.createCard(boardId, laneId, title, description)
          return {
            success: true,
            toolName,
            params,
            result: { id: card.id, title: card.title, laneId: card.laneId },
            timestamp: new Date().toISOString()
          }
        }
        // ... 其他工具
      }
    } catch (error) {
      return {
        success: false,
        toolName,
        params,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }
}
```

**执行结果格式**:
```typescript
interface ToolExecutionResult {
  success: boolean        // 执行是否成功
  toolName: string      // 工具名称
  params: Record<string, unknown>  // 调用参数
  result?: unknown       // 返回数据（成功时）
  error?: string        // 错误信息（失败时）
  timestamp: string     // 时间戳
}
```

---

## 客户端/服务端分离设计

### 为什么需要分离？

1. **安全性**: 客户端不应直接访问数据库
2. **包体积**: lowdb 只能在服务端使用
3. **权限控制**: 服务端可以验证用户权限

### 客户端工具定义

**文件**: `lib/ai-tools/tools/*.ts`

**特点**:
- 仅包含元数据（名称、描述、参数）
- `execute()` 方法返回错误提示
- 用于构建 Prompt 和 UI 展示

```typescript
// 客户端工具 - 仅元数据
export class CreateCardTool extends BaseTool {
  name = 'create_card'
  description = '在指定列表中创建新卡片'
  paramSchema: ToolParameterSchema[] = [...]

  async execute(): Promise<ToolExecutionResult> {
    return {
      success: false,
      error: 'Tool execution must be done on server side',
      ...
    }
  }
}
```

### 服务端执行器

**文件**: `lib/ai-tools/server-executor.ts`

**特点**:
- 使用 switch-case 分发工具调用
- 直接调用 dbHelpers
- 返回统一格式的执行结果

---

## API 集成

### 1. AI 聊天 API

**路由**: `POST /api/ai/chat`

**功能**: 调用 DeepSeek API

```typescript
export async function POST(request: Request) {
  const { messages, model = 'deepseek-chat' } = await request.json()

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },  // 包含工具定义
        ...messages
      ]
    })
  })

  const data = await response.json()
  const content = data.choices[0].message.content
  return NextResponse.json({ content })
}
```

---

### 2. 工具执行 API

**路由**: `POST /api/ai/tools/execute`

**功能**: 执行工具调用

```typescript
export const runtime = 'nodejs'  // 必须使用 Node.js 运行时

export async function POST(request: Request) {
  const { toolCalls } = await request.json()

  const results: ToolExecutionResult[] = []
  for (const call of toolCalls) {
    const result = await ServerToolExecutor.execute(call)
    results.push(result)
  }

  return NextResponse.json({ success: true, data: results })
}
```

---

## UI 组件集成

### DeepSeekChatPanel

**文件**: `components/ai/DeepSeekChatPanel.tsx`

**核心功能**:

```typescript
// 1. 发送消息
const handleSend = async () => {
  const systemPrompt = PromptBuilder.buildToolSystemPrompt({
    currentBoard: { id: boardId, title: '...' },
    currentLanes: lanes.map(l => ({ ... }))
  })

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
        { role: 'user', content: input }
      ]
    })
  })

  const aiResponse = await response.json()

  // 2. 解析工具调用
  const toolCalls = ToolCallParser.parse(aiResponse.content)

  if (toolCalls && toolCalls.length > 0) {
    setPendingToolCalls(toolCalls)
    setShowToolConfirm(true)  // 显示确认对话框
  }
}

// 3. 确认执行
const handleConfirmExecute = async () => {
  const response = await fetch('/api/ai/tools/execute', {
    method: 'POST',
    body: JSON.stringify({ toolCalls: pendingToolCalls })
  })

  const results = await response.json()

  // 4. 添加到日志
  const newLogs: OperationLog[] = results.data.map(r => ({
    id: nanoid(),
    toolName: r.toolName,
    success: r.success,
    timestamp: r.timestamp,
    data: r.result,
    error: r.error
  }))

  setOperationLogs(prev => [...prev, ...newLogs])
}
```

---

### ToolCallConfirmation

**功能**: 工具调用确认对话框

**显示信息**:
- 工具名称映射（`create_card` → "创建卡片"）
- 操作目标（"在「待办」列表创建卡片"）
- 具体参数（标题、描述等）

```typescript
const toolDisplayNames: Record<string, string> = {
  create_card: '创建卡片',
  update_card: '更新卡片',
  move_card: '移动卡片',
  delete_card: '删除卡片',
  create_lane: '创建列表',
  update_lane: '更新列表',
  delete_lane: '删除列表',
  create_board: '创建看板',
  update_board: '更新看板',
  delete_board: '删除看板',
}
```

---

### OperationLogPanel

**功能**: 操作日志面板

**日志内容**:
- 执行时间
- 工具名称
- 执行状态（成功/失败）
- 结果数据或错误信息

```typescript
interface OperationLog {
  id: string
  toolName: string
  success: boolean
  timestamp: string
  data?: unknown
  error?: string
}
```

---

## 扩展新工具

### 步骤 1: 创建工具类

**文件**: `lib/ai-tools/tools/[category]-tools.ts`

```typescript
import { BaseTool } from './base'
import type { ToolExecutionResult } from '@/types/ai-tools.types'

export class NewTool extends BaseTool {
  name = 'new_tool'                    // 工具名称
  description = '工具功能描述'             // 工具描述
  category = 'card' as const             // 分类
  paramSchema: ToolParameterSchema[] = [    // 参数定义
    {
      name: 'param1',
      type: 'string',
      required: true,
      description: '参数1说明'
    }
  ]

  // 客户端返回错误（服务端执行）
  async execute(): Promise<ToolExecutionResult> {
    return {
      success: false,
      toolName: this.name,
      params: {},
      error: 'Tool execution must be done on server side',
      timestamp: new Date().toISOString()
    }
  }
}
```

### 步骤 2: 注册工具

**文件**: `lib/ai-tools/tools/registry.ts`

```typescript
import { NewTool } from './[category]-tools'

class ToolRegistry {
  constructor() {
    // ...
    this.register(new NewTool())  // 添加注册
  }
}
```

### 步骤 3: 实现服务端执行

**文件**: `lib/ai-tools/server-executor.ts`

```typescript
export class ServerToolExecutor {
  static async execute(toolCall: ToolCallRequest) {
    const { toolName, params } = toolCall

    switch (toolName) {
      // ...
      case 'new_tool': {
        const { param1 } = params as { param1: string }
        // 调用 dbHelpers 或其他逻辑
        const result = await someOperation(param1)
        return {
          success: true,
          toolName,
          params,
          result: { ...result },
          timestamp: new Date().toISOString()
        }
      }
    }
  }
}
```

### 步骤 4: 更新 UI 显示名称

**文件**: `components/ai/ToolCallConfirmation.tsx`

```typescript
const toolDisplayNames: Record<string, string> = {
  // ...
  new_tool: '新工具显示名称'
}
```

---

## 常见问题

**Q: AI 返回的不是标准工具调用格式？**

A: 使用 `FallbackToolParser` 尝试提取卡片草稿，支持多种自然语言表达模式。

**Q: 工具调用参数有误？**

A: 使用 `BaseTool.validateParams()` 验证参数，会返回详细错误信息。

**Q: 如何调试 AI 响应？**

A: 查看 `DeepSeekChatPanel` 中的 `console.log` 输出，或查看操作日志。

**Q: 工具执行失败如何处理？**

A: 检查 `OperationLogPanel` 中的错误信息，或查看服务器控制台日志。

---

## 相关文档

- [API Routes](./api-routes.md)
- [组件文档](./components.md)
- [架构概述](./architecture.md)
- [AI 工具使用手册](./ai-tools-guide.md)
