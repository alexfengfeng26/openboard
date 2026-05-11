# 模板管理系统优化方案

> 版本：v1.0
> 日期：2026-05-11
> 状态：设计阶段（待评审）

---

## 一、现状分析

### 1.1 现有模板系统概览

当前项目中存在 **3 套相互独立的模板系统**，分别服务于不同场景：

| 模板类型 | 存储位置 | 持久化 | 用户可自定义 | 管理界面 |
|----------|----------|--------|------------|----------|
| **看板模板** | `lib/templates/board-templates.ts` | ❌ 硬编码 | ❌ | 创建看板向导 |
| **AI 聊天模板** | `lib/ai/commands.ts` + `data/settings.json` | ⚠️ 部分持久化 | ✅ 有限自定义 | AI 设置对话框 |
| **自动化规则模板** | `lib/automation/templates.ts` | ❌ 硬编码 | ❌ | 自动化面板 |

### 1.2 核心问题

#### 问题 1：架构割裂，维护成本高
三套模板系统各自为政，数据结构不统一，新增一种模板需要从零搭建存储、API、UI 三层。

#### 问题 2：硬编码模板无法动态扩展
看板模板和自动化规则模板写死在 TS 文件中，用户无法：
- 将自己搭建好的看板保存为模板
- 将常用卡片/列表保存为模板复用
- 导入同事分享的模板

#### 问题 3：AI 聊天模板能力受限
AI 命令模板虽然存储在 `settings.json` 中，但：
- 与看板数据无关联（无法引用当前看板结构、标签等上下文）
- 仅支持纯文本插入，不支持参数化变量（如 `{{board.title}}`、`{{lane.name}}`）
- 界面混杂在 AI 设置中，而非独立的模板管理入口

#### 问题 4：缺少卡片级模板
实际高频场景：某类卡片（如"Bug 报告"、"需求评审"）字段结构高度相似，目前只能每次手动填写，无法一键套用模板。

#### 问题 5：缺乏模板生态能力
- 无导入/导出功能
- 无模板市场/共享机制的基础设计
- 无模板搜索、分类、标签能力

---

## 二、优化目标

| 目标编号 | 目标描述 | 优先级 |
|----------|----------|--------|
| G1 | 建立**统一的模板管理层**，所有模板类型共享一套基础设施 | P0 |
| G2 | 支持**用户自定义模板**（从现有数据创建 + 从零新建） | P0 |
| G3 | 支持**模板变量系统**，让模板内容可动态引用当前上下文 | P1 |
| G4 | 新增**卡片模板**类型，覆盖高频复用场景 | P0 |
| G5 | 提供**独立的模板管理界面**（浏览、搜索、增删改、导入导出） | P1 |
| G6 | 支持**模板导入/导出**（JSON 格式），为后续共享生态打基础 | P1 |
| G7 | 保持与现有系统的**向后兼容**，逐步迁移而非暴力替换 | P0 |

---

## 三、总体架构设计

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        模板管理前端层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ 模板管理面板  │  │ 模板选择弹窗  │  │ 模板变量插入器        │   │
│  │ (Template    │  │ (Template    │  │ (TemplateVariable   │   │
│  │  Manager)    │  │  Selector)   │  │  Inserter)          │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              模板应用层（各业务场景接入点）                  │   │
│  │  • 创建看板向导 → 选择看板模板                              │   │
│  │  • 创建卡片弹窗 → 选择卡片模板                              │   │
│  │  • 创建列表弹窗 → 选择列表模板                              │   │
│  │  • 新建自动化规则 → 选择规则模板                            │   │
│  │  • AI 聊天输入框 → 选择提示词模板 + 变量替换                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        模板管理核心层                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              TemplateManager (统一入口类)                  │   │
│  │  • list(scope?, type?, tag?)                            │   │
│  │  • get(id)                                              │   │
│  │  • create(template: TemplateDraft)                      │   │
│  │  • update(id, patch)                                    │   │
│  │  • delete(id)                                           │   │
│  │  • apply(id, context) → 返回应用后的数据                   │   │
│  │  • export(ids) → JSON                                   │   │
│  │  • import(json)                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Template   │    │  Template   │    │  Template   │         │
│  │  Registry   │    │  Storage    │    │  Variable   │         │
│  │  (注册表)    │    │  (存储适配)  │    │  Resolver   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        模板存储层                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              data/templates/ 目录结构                      │   │
│  │                                                         │   │
│  │  templates.json        # 模板索引（元数据清单）             │   │
│  │  board/                # 看板模板数据文件                  │   │
│  │    ├── basic.json      # 内置模板（可复制不可编辑）          │   │
│  │    └── user-xxx.json   # 用户自定义模板                     │   │
│  │  card/                 # 卡片模板数据文件                  │   │
│  │  lane/                 # 列表模板数据文件                  │   │
│  │  automation/           # 自动化规则模板数据文件             │   │
│  │  prompt/               # AI 提示词模板数据文件              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 核心设计原则

1. **统一抽象**：所有模板类型共享同一个 `Template` 基类型，通过 `type` 字段区分具体种类
2. **存储隔离**：不同类型的模板数据存储在不同子目录，但索引统一汇聚到 `templates.json`
3. **内置模板不可变**：系统预设模板标记为 `builtin: true`，用户可复制后编辑，但不可直接修改原模板
4. **变量延迟解析**：模板内容中的变量以 `{{variableName}}` 形式保存，在 `apply()` 阶段根据传入的 `context` 解析
5. **渐进式迁移**：保留现有硬编码模板作为"内置模板"，逐步引导用户向新系统迁移

---

## 四、数据模型设计

### 4.1 统一模板类型

```typescript
// types/template.types.ts

export type TemplateType = 'board' | 'card' | 'lane' | 'automation' | 'prompt'

export type TemplateScope = 'global' | 'board'

export interface TemplateMeta {
  id: string
  type: TemplateType
  name: string
  description?: string
  tags?: string[]           // 分类标签，如 ['敏捷', '开发', '运营']
  icon?: string             // lucide-react 图标名
  color?: string            // 主题色（十六进制）
  scope: TemplateScope      // global = 全局可用；board = 绑定到特定看板
  boardId?: string          // scope === 'board' 时必填
  builtin: boolean          // 是否为系统内置模板
  sourceId?: string         // 从哪个看板/卡片/规则创建的（溯源）
  createdAt: string
  updatedAt: string
}

// 各类型模板的具体数据内容
export type TemplateContent =
  | BoardTemplateContent
  | CardTemplateContent
  | LaneTemplateContent
  | AutomationTemplateContent
  | PromptTemplateContent

export interface Template {
  meta: TemplateMeta
  content: TemplateContent
}

// 创建模板时的草稿（不含 id、createdAt、updatedAt）
export type TemplateDraft = Omit<Template, 'meta'> & {
  meta: Omit<TemplateMeta, 'id' | 'createdAt' | 'updatedAt'>
}
```

### 4.2 各类型模板内容结构

#### 4.2.1 看板模板（Board Template）

```typescript
export interface BoardTemplateContent {
  lanes: {
    title: string
    cards?: CardTemplateContent[]  // 支持预置示例卡片
  }[]
  tags?: Tag[]  // 预置标签池
}
```

> 与现有 `BoardTemplate` 的差异：新增 `cards` 支持（列表内可预置示例卡片）、新增 `tags` 支持。

#### 4.2.2 卡片模板（Card Template）【新增】

```typescript
export interface CardTemplateContent {
  title: string
  description?: string
  tags?: string[]        // 标签名数组（应用时匹配当前看板标签池）
  attachments?: {
    name: string
    type: string
    // 注：附件不存实际文件内容，仅存占位信息，应用时提示用户上传
  }[]
}
```

#### 4.2.3 列表模板（Lane Template）【新增】

```typescript
export interface LaneTemplateContent {
  title: string
  cards?: CardTemplateContent[]
}
```

#### 4.2.4 自动化规则模板（Automation Template）

```typescript
export interface AutomationTemplateContent {
  trigger: AutomationTrigger
  actions: AutomationAction[]
}
```

> 与现有 `RuleTemplate` 基本一致，但纳入统一框架管理。

#### 4.2.5 AI 提示词模板（Prompt Template）

```typescript
export interface PromptTemplateContent {
  text: string              // 提示词文本，支持 {{variable}} 变量
  variables?: string[]      // 模板中使用的变量名列表（自动提取或手动声明）
  model?: 'deepseek-chat' | 'deepseek-reasoner'  // 建议使用的模型
  autoSend?: boolean        // 应用后是否自动发送（false = 仅填充输入框）
}
```

> 替代现有的 `AiCommand`（`kind: 'snippet'`），统一迁移到新系统。

### 4.3 模板变量系统

```typescript
// types/template.types.ts

export interface TemplateVariableContext {
  board?: Board
  lane?: Lane
  card?: Card
  user?: { name?: string; id?: string }
  date?: { now: string; today: string; tomorrow: string }
  // 可扩展...
}

export interface VariableResolver {
  name: string
  description: string
  resolve: (context: TemplateVariableContext) => string | Promise<string>
}
```

**内置变量清单（v1）**：

| 变量名 | 说明 | 示例输出 |
|--------|------|----------|
| `{{board.title}}` | 当前看板标题 | "Sprint 25" |
| `{{board.id}}` | 当前看板 ID | "board-xxx" |
| `{{lane.title}}` | 当前列表标题 | "进行中" |
| `{{card.title}}` | 当前卡片标题 | "修复登录bug" |
| `{{date.now}}` | 当前时间（ISO） | "2026-05-11T10:00:00Z" |
| `{{date.today}}` | 今日日期 | "2026-05-11" |
| `{{date.tomorrow}}` | 明日日期 | "2026-05-12" |
| `{{user.name}}` | 当前用户名称 | "张三" |

> AI 提示词模板是变量系统的最大受益者。例如：
> ```
> 请为看板 "{{board.title}}" 的 "{{lane.title}}" 列中的卡片生成今日待办任务，
> 今天日期是 {{date.today}}。
> ```

---

## 五、存储层设计

### 5.1 目录结构

```
data/
├── templates/
│   ├── templates.json              # 统一索引文件
│   ├── board/
│   │   ├── basic.json              # 内置：基础看板
│   │   ├── scrum.json              # 内置：Scrum Sprint
│   │   ├── content.json            # 内置：内容运营
│   │   ├── bug-track.json          # 内置：Bug 跟踪
│   │   └── user-{id}.json          # 用户自定义
│   ├── card/
│   │   ├── bug-report.json         # 内置：Bug 报告
│   │   ├── feature-request.json    # 内置：需求申请
│   │   └── user-{id}.json          # 用户自定义
│   ├── lane/
│   │   └── user-{id}.json
│   ├── automation/
│   │   ├── auto-tag-on-create.json # 内置：创建时自动匹配标签
│   │   ├── auto-tag-on-update.json # 内置：更新时自动匹配标签
│   │   └── user-{id}.json
│   └── prompt/
│       ├── daily-standup.json      # 内置：每日站会
│       ├── sprint-planning.json    # 内置：Sprint 规划
│       ├── code-review.json        # 内置：代码审查
│       └── user-{id}.json
```

### 5.2 索引文件格式（templates.json）

```json
{
  "version": 1,
  "updatedAt": "2026-05-11T10:00:00Z",
  "templates": [
    {
      "id": "board-basic",
      "type": "board",
      "name": "基础看板",
      "description": "经典的待办/进行中/已完成三列看板",
      "tags": ["通用"],
      "icon": "Layout",
      "scope": "global",
      "builtin": true,
      "path": "board/basic.json"
    },
    {
      "id": "card-bug-report",
      "type": "card",
      "name": "Bug 报告",
      "description": "标准 Bug 报告卡片模板",
      "tags": ["开发", "Bug"],
      "icon": "Bug",
      "scope": "global",
      "builtin": true,
      "path": "card/bug-report.json"
    }
  ]
}
```

**设计理由**：
- 索引与数据分离：浏览模板列表时只需读取轻量索引，无需解析每个模板文件
- `path` 字段定位实际数据文件，支持灵活的文件组织
- 索引可重建：若索引损坏或丢失，可通过扫描子目录自动重建

### 5.3 存储适配器接口

```typescript
// lib/storage/TemplateStorage.ts

export interface TemplateStorage {
  // 索引操作
  getIndex(): Promise<TemplateIndex>
  updateIndex(index: TemplateIndex): Promise<void>
  rebuildIndex(): Promise<TemplateIndex>

  // 模板数据操作
  read(type: TemplateType, id: string): Promise<Template | null>
  write(type: TemplateType, id: string, template: Template): Promise<void>
  remove(type: TemplateType, id: string): Promise<void>
  list(type?: TemplateType): Promise<Template[]>

  // 批量导入导出
  export(ids: string[]): Promise<ExportBundle>
  import(bundle: ExportBundle): Promise<ImportResult>
}
```

### 5.4 数据迁移策略

**第一阶段：保留现有系统，影子运行**
- 新模板系统上线时，现有 `lib/templates/board-templates.ts`、`lib/ai/commands.ts`、`lib/automation/templates.ts` 继续保留
- 新系统首次启动时，将硬编码模板自动导入到 `data/templates/` 目录，标记为 `builtin: true`
- 所有读取模板的入口优先从新系统读取，若未找到则回退到旧系统

**第二阶段：完全迁移**
- 当确认新系统稳定运行后，移除硬编码模板的回退逻辑
- 将 `settings.json` 中的 `ai.commands`（snippet 类型）迁移到新系统的 `prompt/` 目录
- 旧数据结构保留一段时间作为备份，后续清理

---

## 六、API 路由设计

### 6.1 REST API 清单

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/templates` | GET | 获取模板列表（支持 `?type=`、`?scope=`、`?tag=`、`?q=` 搜索过滤） |
| `/api/templates` | POST | 创建新模板 |
| `/api/templates/[id]` | GET | 获取单个模板 |
| `/api/templates/[id]` | PUT | 更新模板（builtin 模板拒绝修改） |
| `/api/templates/[id]` | DELETE | 删除模板（builtin 模板拒绝删除） |
| `/api/templates/[id]/apply` | POST | 应用模板（传入 context，返回填充后的数据） |
| `/api/templates/[id]/clone` | POST | 复制内置模板为自定义模板 |
| `/api/templates/export` | POST | 批量导出模板（body 传 id 数组） |
| `/api/templates/import` | POST | 导入模板（body 传 JSON bundle） |

### 6.2 关键接口详情

#### GET /api/templates

**查询参数**：
- `type`: `board` | `card` | `lane` | `automation` | `prompt`
- `scope`: `global` | `board`
- `boardId`: 当 scope=board 时必填
- `tag`: 按标签过滤（支持多个，逗号分隔）
- `q`: 关键词搜索（匹配 name、description、tags）

**响应**：
```json
{
  "success": true,
  "templates": [
    { "meta": { ... }, "content": { ... } }
  ],
  "total": 10
}
```

#### POST /api/templates

**请求体（创建看板模板示例）**：
```json
{
  "meta": {
    "type": "board",
    "name": "我的项目看板",
    "description": "从现有看板保存的模板",
    "tags": ["项目"],
    "scope": "global"
  },
  "content": {
    "lanes": [
      { "title": "需求池", "cards": [{ "title": "示例卡片" }] },
      { "title": "开发中" },
      { "title": "已上线" }
    ]
  }
}
```

#### POST /api/templates/[id]/apply

**请求体**：
```json
{
  "context": {
    "board": { "id": "board-123", "title": "Sprint 25" },
    "lane": { "id": "lane-456", "title": "进行中" }
  }
}
```

**响应（prompt 模板示例）**：
```json
{
  "success": true,
  "resolved": {
    "text": "请为看板 \"Sprint 25\" 的 \"进行中\" 列中的卡片生成今日待办任务，今天日期是 2026-05-11。"
  }
}
```

---

## 七、前端组件设计

### 7.1 新增组件清单

| 组件 | 路径 | 职责 |
|------|------|------|
| `TemplateManager` | `components/template/TemplateManager.tsx` | 模板管理主面板（独立页面/弹窗） |
| `TemplateCard` | `components/template/TemplateCard.tsx` | 模板卡片展示（缩略图+信息+操作） |
| `TemplateSelector` | `components/template/TemplateSelector.tsx` | 模板选择弹窗（各业务场景通用） |
| `TemplateEditor` | `components/template/TemplateEditor.tsx` | 模板编辑器（新建/编辑） |
| `TemplateVariablePicker` | `components/template/TemplateVariablePicker.tsx` | 变量选择器（在编辑器中插入变量） |
| `PromptTemplatePreview` | `components/template/PromptTemplatePreview.tsx` | 提示词模板实时预览（变量高亮+解析预览） |
| `CreateFromTemplateButton` | `components/template/CreateFromTemplateButton.tsx` | "保存为模板"按钮（散布在各业务组件中） |

### 7.2 TemplateManager 布局设计

```
┌─────────────────────────────────────────────────────────────┐
│  模板管理                                      [+ 新建模板]  │
├──────────┬──────────────────────────────────────────────────┤
│          │  🔍 搜索模板...    [全部 ▼] [标签 ▼]             │
│  📋 看板  │                                                    │
│  📝 卡片  │  ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  📊 列表  │  │ 基础看板 │ │Scrum    │ │内容运营  │            │
│  ⚡ 规则  │  │ [内置]   │ │Sprint   │ │         │            │
│  🤖 提示  │  │ 待办     │ │ [内置]  │ │ [内置]  │            │
│          │  │ 进行中   │ │ Backlog │ │ 选题池   │            │
│          │  │ 已完成   │ │ ...     │ │ ...     │            │
│          │  │         │ │         │ │         │            │
│          │  │ [使用]  │ │ [使用] [⋮]│ │ [使用] [⋮]│            │
│          │  └─────────┘ └─────────┘ └─────────┘            │
│          │                                                    │
│          │  ┌─────────┐                                     │
│          │  │ 我的模板 │                                     │
│          │  │ [自定义] │                                     │
│          │  │         │                                     │
│          │  │ [编辑] [删除]                                  │
│          │  └─────────┘                                     │
│          │                                                    │
└──────────┴──────────────────────────────────────────────────┘
```

**左侧导航**：按模板类型切换
**顶部过滤栏**：搜索框 + 类型过滤下拉 + 标签云
**模板卡片**：展示图标、名称、描述、标签、内置/自定义标识
**卡片操作**：
- 内置模板：`[使用]`、`[复制并编辑]`
- 自定义模板：`[使用]`、`[编辑]`、`[删除]`、`[导出]`

### 7.3 模板选择弹窗（TemplateSelector）

在各业务场景中嵌入的通用组件：

```typescript
interface TemplateSelectorProps {
  type: TemplateType              // 过滤模板类型
  scope?: TemplateScope           // 可选：过滤作用域
  boardId?: string                // 可选：当前看板 ID（用于 board 作用域模板）
  onSelect: (template: Template) => void
  onCancel: () => void
}
```

**使用场景**：
- `CreateBoardDialog`：创建看板时选择看板模板
- `CreateCardDialog`：创建卡片时选择卡片模板
- `CreateLaneDialog`：创建列表时选择列表模板
- `AutomationPanel`：新建规则时选择规则模板
- `DeepSeekChatPanel`：AI 聊天时选择提示词模板

### 7.4 "保存为模板"交互设计

在看板、列表、卡片、规则的上下文菜单中增加"保存为模板"选项：

```
┌─────────────┐
│  编辑        │
│  删除        │
│ ─────────── │
│  保存为模板 → │  ┌──────────────────────┐
│ ─────────── │  │  保存为看板模板       │
│  复制链接    │  │  保存为列表模板       │
└─────────────┘  │  保存为卡片模板       │
                 └──────────────────────┘
```

点击后弹出 `TemplateEditor` 预填当前数据，用户微调后保存。

---

## 八、模板变量系统实现设计

### 8.1 变量语法

采用双大括号语法：`{{variableName}}`

支持嵌套属性访问：`{{board.title}}`、`{{date.today}}`

支持默认值（fallback）：`{{user.name|匿名用户}}`

### 8.2 变量解析器实现

```typescript
// lib/template/variable-resolver.ts

const BUILTIN_VARIABLES: Record<string, VariableResolver> = {
  'board.title': {
    name: 'board.title',
    description: '当前看板标题',
    resolve: (ctx) => ctx.board?.title ?? '',
  },
  'board.id': {
    name: 'board.id',
    description: '当前看板 ID',
    resolve: (ctx) => ctx.board?.id ?? '',
  },
  'lane.title': {
    name: 'lane.title',
    description: '当前列表标题',
    resolve: (ctx) => ctx.lane?.title ?? '',
  },
  'card.title': {
    name: 'card.title',
    description: '当前卡片标题',
    resolve: (ctx) => ctx.card?.title ?? '',
  },
  'date.now': {
    name: 'date.now',
    description: '当前时间（ISO）',
    resolve: () => new Date().toISOString(),
  },
  'date.today': {
    name: 'date.today',
    description: '今日日期',
    resolve: () => new Date().toISOString().split('T')[0],
  },
  'date.tomorrow': {
    name: 'date.tomorrow',
    description: '明日日期',
    resolve: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    },
  },
  'user.name': {
    name: 'user.name',
    description: '当前用户名称',
    resolve: (ctx) => ctx.user?.name ?? '',
  },
}

export function resolveVariables(
  text: string,
  context: TemplateVariableContext
): string {
  return text.replace(/\{\{(\w+(?:\.\w+)?)(?:\|([^}]*))?\}\}/g, (match, varName, fallback) => {
    const resolver = BUILTIN_VARIABLES[varName]
    if (!resolver) return fallback ?? match
    const value = resolver.resolve(context)
    return value || fallback || match
  })
}
```

### 8.3 提示词模板编辑器中的变量交互

在 `TemplateEditor` 编辑 `prompt` 类型模板时：

1. **变量高亮**：输入框中 `{{xxx}}` 以特殊颜色高亮显示
2. **变量选择器**：侧边栏或浮层面板展示可用变量列表，点击即可插入光标位置
3. **实时预览**：下方显示变量解析后的实际文本（传入模拟 context）

---

## 九、导入导出设计

### 9.1 导出包格式

```typescript
interface ExportBundle {
  version: 1
  exportedAt: string
  templates: Template[]
}
```

**示例**：
```json
{
  "version": 1,
  "exportedAt": "2026-05-11T10:00:00Z",
  "templates": [
    {
      "meta": {
        "type": "board",
        "name": "Scrum Sprint",
        "description": "敏捷开发 Sprint 看板",
        "tags": ["敏捷", "开发"],
        "icon": "Rocket",
        "scope": "global",
        "builtin": false
      },
      "content": {
        "lanes": [
          { "title": "Backlog" },
          { "title": "Todo" },
          { "title": "In Progress" },
          { "title": "Review" },
          { "title": "Done" }
        ]
      }
    }
  ]
}
```

### 9.2 导入流程

1. 用户上传 JSON 文件或粘贴 JSON 文本
2. 前端校验格式（`version`、`templates` 数组）
3. 后端逐条校验每个模板的数据完整性
4. 冲突检测：若模板名称与现有自定义模板重复，提示用户选择"覆盖/跳过/重命名"
5. 导入完成后刷新模板列表

### 9.3 与现有 AI 命令的兼容性

旧版 `settings.json` 中的 `ai.commands`（snippet 类型）可以一键导出为新的 prompt 模板包，方便用户迁移。

---

## 十、渐进式迁移计划

### Phase 1：影子运行（2 周）

**目标**：新系统上线，旧系统继续可用

- [ ] 实现 `TemplateStorage` 存储层
- [ ] 实现 `TemplateManager` 核心类
- [ ] 实现 `/api/templates/*` API 路由
- [ ] 实现内置模板的自动导入（首次启动将硬编码模板写入 `data/templates/`）
- [ ] 保留旧 API 路由和硬编码模板作为回退
- [ ] `CreateBoardDialog` 接入 `TemplateSelector`（优先新系统，回退旧系统）

### Phase 2：功能补齐（2 周）

**目标**：新系统功能完善，用户开始使用自定义模板

- [ ] 实现 `TemplateManager` UI 面板
- [ ] 实现 `TemplateEditor` 编辑器
- [ ] 实现卡片模板类型及 `CreateCardDialog` 接入
- [ ] 实现列表模板类型及 `CreateLaneDialog` 接入
- [ ] 实现"保存为模板"功能（看板/列表/卡片/规则上下文菜单）
- [ ] 实现模板变量系统（v1：基础变量）
- [ ] 实现导入/导出功能

### Phase 3：AI 模板迁移（1 周）

**目标**：AI 聊天模板完全迁移到新系统

- [ ] 实现 prompt 模板类型
- [ ] `DeepSeekChatPanel` 接入 `TemplateSelector`
- [ ] 迁移 `settings.json` 中的 `ai.commands`（snippet 类型）到 `data/templates/prompt/`
- [ ] 更新 `AiSettingsDialog`，移除 snippet 管理，改为跳转到 `TemplateManager`
- [ ] 更新 `ChatInputArea` 快捷模板按钮的数据源

### Phase 4：自动化模板迁移（1 周）

**目标**：自动化规则模板迁移完成

- [ ] 将 `lib/automation/templates.ts` 硬编码模板导入新系统
- [ ] `AutomationPanel` 接入 `TemplateSelector`
- [ ] 旧硬编码模板 API 标记为 deprecated

### Phase 5：清理收尾（1 周）

**目标**：移除旧系统代码

- [ ] 移除 `lib/templates/board-templates.ts` 的回退读取逻辑
- [ ] 移除 `lib/ai/commands.ts` 中的 snippet 定义
- [ ] 移除 `lib/automation/templates.ts` 的回退读取逻辑
- [ ] 清理 `settings.json` 中已迁移的 `ai.commands` 数据
- [ ] 更新文档和 `AGENTS.md`

---

## 十一、与现有系统的兼容性

### 11.1 向后兼容保证

| 现有接口 | 兼容策略 |
|----------|----------|
| `GET /api/automation/templates` | 保留，内部转发到新系统的 `list(type='automation')` |
| `lib/templates/board-templates.ts` | 保留文件，标记 deprecated，内部导出转发到 `TemplateManager` |
| `lib/ai/commands.ts` 的 snippet | 保留函数，首次读取时从新系统加载，若不存在则使用默认值 |
| `data/settings.json` 的 `ai.commands` | 保留字段，Phase 3 完成后清理 |

### 11.2 数据安全

- 所有模板文件操作使用现有的 `FileLock` 机制防止并发写入
- 内置模板文件标记为只读，修改操作自动创建副本
- 导入模板前进行 JSON Schema 校验，防止恶意数据

---

## 十二、风险评估与应对

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| 模板数据量激增导致索引文件过大 | 中 | 索引仅存储元数据（平均 < 500B/条），10,000 条模板约 5MB，完全可接受 |
| 用户误删重要内置模板 | 低 | 内置模板 `builtin: true`，删除操作被禁止；只能通过"复制并编辑"创建副本 |
| 模板变量解析失败导致内容异常 | 低 | 变量解析失败时保留原始 `{{variable}}` 文本或 fallback 值，绝不抛错 |
| 导入的模板与当前数据结构不兼容 | 中 | 导入时严格校验 JSON Schema，类型不匹配时跳过并返回警告信息 |
| 新旧系统同时运行导致数据不一致 | 低 | Phase 1 中写操作统一走新系统，旧系统仅作为只读回退 |

---

## 十三、附录

### 13.1 相关文件变更清单

**新增文件**：
```
types/template.types.ts
lib/template/TemplateManager.ts
lib/template/variable-resolver.ts
lib/storage/TemplateStorage.ts
app/api/templates/route.ts
app/api/templates/[id]/route.ts
app/api/templates/[id]/apply/route.ts
app/api/templates/[id]/clone/route.ts
app/api/templates/export/route.ts
app/api/templates/import/route.ts
components/template/TemplateManager.tsx
components/template/TemplateCard.tsx
components/template/TemplateSelector.tsx
components/template/TemplateEditor.tsx
components/template/TemplateVariablePicker.tsx
components/template/PromptTemplatePreview.tsx
components/template/CreateFromTemplateButton.tsx
```

**修改文件**：
```
app/api/boards/route.ts           # 创建看板时接入 TemplateSelector
app/api/automation/templates/route.ts  # 内部转发到新系统
components/board/CreateBoardDialog.tsx   # 模板选择逻辑替换
components/card/CreateCardDialog.tsx     # 新增卡片模板选择
components/lane/CreateLaneDialog.tsx     # 新增列表模板选择
components/ai/DeepSeekChatPanel.tsx      # 提示词模板选择
components/ai/ChatInputArea.tsx          # 快捷模板数据源替换
components/automation/AutomationPanel.tsx # 规则模板选择
```

**最终移除文件**（Phase 5）：
```
lib/templates/board-templates.ts   # 硬编码看板模板
lib/ai/commands.ts 中的 snippet 定义  # 硬编码 AI 命令
lib/automation/templates.ts        # 硬编码规则模板
```

### 13.2 命名规范

- 文件/组件：PascalCase（`TemplateManager.tsx`）
- API 路由：kebab-case（`[id]/apply/route.ts`）
- 模板 ID：kebab-case（`board-basic`、`card-bug-report`）
- 用户自定义模板 ID：保留 `user-` 前缀（`user-a1b2c3`）

### 13.3 未来扩展方向

1. **模板市场**：在 `TemplateManager` 中增加"发现"页签，从远程服务器拉取社区共享模板
2. **团队模板**：扩展 `scope` 为 `team`，支持同一团队内的模板共享
3. **条件模板**：卡片模板支持条件逻辑（如 `{{if board.tags.includes('Bug')}}...{{/if}}`）
4. **模板版本控制**：为模板增加版本历史，支持回滚
5. **AI 生成模板**：通过 AI 根据自然语言描述自动生成看板/卡片模板结构

---

*本文档由 AI 助手生成，供开发团队评审和讨论。方案中的具体实现细节可在编码阶段根据实际情况调整。*
