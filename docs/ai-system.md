# AI 工具系统

本文档涵盖 AI 工具系统的架构实现与使用方式。

---

## 功能概述

AI 工具调用允许用户通过自然语言对话执行看板操作（创建、更新、移动、删除卡片/列表/看板）。所有修改操作在执行前需用户确认，并记录完整操作日志。

---

## 使用方式

### 1. 打开 AI 聊天面板

点击右侧 **"Chat"** 按钮打开 AI 对话面板。

### 2. 输入自然语言指令

示例：
```
创建一张卡片：优化登录功能
把卡片"修复登录 bug"移到"进行中"列表
删除卡片 card-12345
```

### 3. 确认执行

AI 返回的工具调用会显示确认对话框，包含操作类型、目标对象和具体参数。点击**"确认执行"**后才会生效。

### 4. 查看操作日志

点击聊天面板中的 **"日志(X)"** 按钮查看历史操作记录。

### 快捷指令

输入框下方提供快捷模板：
- **生成待办任务**
- **拆分为子任务**
- **总结为卡片**

---

## 系统架构

```
用户输入 → DeepSeekChatPanel → /api/ai/chat → DeepSeek API
                                              ↓
                                       返回工具调用 JSON
                                              ↓
                                       ToolCallParser 解析
                                              ↓
                                       ToolCallConfirmation 用户确认
                                              ↓
                                       /api/ai/tools/execute
                                              ↓
                                       ServerToolExecutor → 更新数据
```

---

## 核心模块

### 1. 工具定义 (`lib/ai-tools/tools/`)

**BaseTool 基类**：
```typescript
export abstract class BaseTool implements ToolDefinition {
  abstract name: string
  abstract description: string
  abstract category: 'board' | 'lane' | 'card'
  abstract paramSchema: ToolParameterSchema[]

  getPromptDescription(): string { ... }
  validateParams(params): { valid: boolean; error?: string } { ... }
  abstract execute(params): Promise<ToolExecutionResult>
}
```

**已注册工具**（`lib/ai-tools/tools/registry.ts`）：

| 分类 | 工具名 | 功能 |
|------|--------|------|
| card | `create_card` | 创建卡片 |
| card | `update_card` | 更新卡片 |
| card | `move_card` | 移动卡片 |
| card | `delete_card` | 删除卡片 |
| lane | `create_lane` | 创建列表 |
| lane | `update_lane` | 更新列表 |
| lane | `delete_lane` | 删除列表 |
| board | `create_board` | 创建看板 |
| board | `update_board` | 更新看板 |
| board | `delete_board` | 删除看板 |

### 2. Prompt 构建器 (`lib/ai-tools/prompt/builder.ts`)

动态构建包含工具定义和当前看板上下文的系统提示词：

```typescript
interface PromptContext {
  currentBoard?: { id: string; title: string }
  currentLanes?: Array<{ id: string; title: string; cardCount: number }>
}
```

### 3. 工具调用解析器 (`lib/ai-tools/parser/`)

- **`tool-call-parser.ts`**：解析标准 JSON 格式工具调用（支持纯 JSON、Markdown 代码块、嵌入文本提取）
- **`fallback-tool-parser.ts`**：当 AI 未返回标准格式时，从文本中提取卡片草稿（支持自然语言模式匹配）

### 4. 服务端执行器 (`lib/ai-tools/server-executor.ts`)

通过 `toolRegistry` 查找工具定义，执行前调用 `validateParams()` 验证参数，然后调用 `dbHelpers` 执行实际数据库操作。

---

## 客户端/服务端分离设计

- **客户端**：仅包含工具元数据，用于构建 Prompt 和 UI 展示；`execute()` 返回错误提示
- **服务端**：通过 `ServerToolExecutor` 直接调用 `dbHelpers`，确保数据安全

---

## 扩展新工具

1. **创建工具类**（`lib/ai-tools/tools/[category]-tools.ts`）：
```typescript
export class NewTool extends BaseTool {
  name = 'new_tool'
  description = '功能描述'
  category = 'card' as const
  paramSchema = [...]
  async execute() { return { success: false, error: '必须在服务端执行' } }
}
```

2. **注册工具**（`lib/ai-tools/tools/registry.ts`）：`this.register(new NewTool())`

3. **实现服务端执行**（`lib/ai-tools/server-executor.ts`）：在 switch-case 中添加对应分支

4. **更新 UI 显示名称**（`components/ai/ToolCallConfirmation.tsx`）：添加 `new_tool` 的中文映射

---

## 常见问题

**Q: AI 返回了普通文字而不是工具调用？**
A: 确保指令包含明确的操作意图，如"创建"、"删除"等关键词。系统也会通过 `FallbackToolParser` 尝试提取卡片草稿。

**Q: 操作执行失败？**
A: 查看操作日志获取详细错误信息，检查输入的 ID 是否正确。

**Q: 如何调试 AI 响应？**
A: 查看浏览器控制台输出，或检查操作日志面板中的错误详情。
