# Lark CLI 与 Kanban-Board 集成方案

> 本方案基于 [Lark CLI 官方能力](https://open.larksuite.com/document/mcp_open_tools/feishu-cli-let-ai-actually-do-your-work-in-feishu) 与当前 kanban-board 项目架构，梳理可落地的结合点与实施路径。

---

## 目录

1. [背景与目标](#1-背景与目标)
2. [Lark CLI 核心能力速览](#2-lark-cli-核心能力速览)
3. [集成场景总览](#3-集成场景总览)
4. [详细方案设计](#4-详细方案设计)
   - 4.1 看板变更通知同步到飞书群聊
   - 4.2 看板数据导出到飞书多维表格 (Base)
   - 4.3 会议纪要待办自动生成看板卡片
   - 4.4 看板日报/周报自动生成飞书文档
   - 4.5 飞书任务与看板卡片双向同步
   - 4.6 飞书机器人作为看板 AI 操控入口
   - 4.7 重要卡片变更飞书审批流
5. [技术实现架构](#5-技术实现架构)
6. [实施优先级建议](#6-实施优先级建议)
7. [附录：常用 Lark CLI 命令参考](#7-附录常用-lark-cli-命令参考)

---

## 1. 背景与目标

当前 **kanban-board** 已具备：
- 基于 Markdown 的看板数据存储 (`data/*.md`)
- DeepSeek AI 工具调用系统 (`lib/ai-tools/`)
- 完整的 REST API (`/api/boards`, `/api/cards`, `/api/lanes`, `/api/ai/*`)
- 标签系统、拖放排序、多看板管理

**Lark CLI** 提供 200+ 命令、19 个 AI Agent Skills，覆盖即时通讯、文档、多维表格、日历、任务、会议、邮件等 11 大业务域。

**集成目标**：将看板系统从"单机工具"升级为"企业协作中枢"，让项目进度自然流入飞书工作流，同时让飞书侧的信息（会议纪要、任务、审批）反哺看板。

---

## 2. Lark CLI 核心能力速览

| 业务域 | 核心能力 | 对应 Skill | 与看板结合的潜力 |
|--------|---------|-----------|-----------------|
| 💬 即时通讯 | 发消息、回复、群聊管理、搜索聊天记录 | `lark-im` | 变更通知、机器人交互入口 |
| 📄 云文档 | 创建/读取/更新/搜索文档，支持 Markdown | `lark-doc` | 自动生成项目日报/周报 |
| 📊 多维表格 | 表、字段、记录、视图、仪表盘 | `lark-base` | 看板数据结构化导出与报表 |
| 📅 日历 | 日程、忙闲查询、时间建议 | `lark-calendar` | 根据看板截止日创建提醒日程 |
| ✅ 任务 | 创建/查询/完成任务、子任务、清单 | `lark-task` | 卡片 ↔ 任务双向同步 |
| 🎥 会议 | 查询会议记录、会议纪要产物 | `lark-vc`, `lark-minutes` | 会议待办自动生成卡片 |
| 📧 邮件 | 收发、搜索、草稿、监听新邮件 | `lark-mail` | 重要变更邮件提醒 |
| 📁 云盘 | 上传下载、权限管理 | `lark-drive` | 附件归档 |
| 👤 通讯录 | 搜索用户、获取资料 | `lark-contact` | @责任人自动关联卡片 |
| ✍️ 审批 | 查询/审批/转交/加签 | `lark-approval` | 关键状态变更审批 gate |
| 📚 知识库 | 空间、节点、文档管理 | `lark-wiki` | 项目知识库沉淀 |

Lark CLI 采用三层命令体系：
1. **Shortcuts** (`+` 前缀)：适合自动化脚本，如 `lark-cli im +messages-send`
2. **API Commands**：精准控制，1:1 映射 OpenAPI
3. **Raw API**：直接调用 2500+ 端点

---

## 3. 集成场景总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          飞书 (Lark) 生态                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │  群聊    │ │  文档    │ │ 多维表格 │ │  日历    │ │  审批    │         │
│  │  (IM)    │ │ (Docs)   │ │ (Base)   │ │(Calendar)│ │(Approval)│         │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘         │
│       │            │            │            │            │                │
│       └────────────┴────────────┼────────────┴────────────┘                │
│                                 ▼                                          │
│                          ┌──────────────┐                                  │
│                          │  Lark CLI    │                                  │
│                          │ (Shell/MCP)  │                                  │
│                          └──────┬───────┘                                  │
└─────────────────────────────────┼──────────────────────────────────────────┘
                                  │
                                  ▼ HTTP / Shell
┌─────────────────────────────────────────────────────────────────────────────┐
│                         kanban-board 本地/服务器                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Next.js API│◄───│ AI Tools    │◄───│ Markdown    │◄───│  Settings   │ │
│  │  Routes     │    │ Executor    │    │ Storage     │    │  (JSON)     │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                                                            │      │
│         └────────────────────┬───────────────────────────────────────┘      │
│                              ▼                                              │
│                       ┌──────────────┐                                      │
│                       │ Notification │ 变更事件触发 Lark CLI 调用           │
│                       │   Service    │                                      │
│                       └──────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 详细方案设计

### 4.1 看板变更通知同步到飞书群聊

**场景**：卡片被创建、移动、完成时，自动发送到指定的飞书群聊。

**实现方式**：
在 Next.js API 路由中，关键写操作成功后，调用 `lark-cli` 发送消息。

**技术路径**：
```typescript
// lib/lark/notifier.ts
import { execSync } from 'child_process'

export function notifyCardChange(event: 'created' | 'moved' | 'completed', card: Card, lane: Lane) {
  const text = `📋 看板更新\n卡片「${card.title}」${event === 'created' ? '已创建' : event === 'moved' ? `已移动到「${lane.title}」` : '已完成'}\n责任人: ${card.assignee || '未分配'}`
  
  execSync(`lark-cli im +messages-send --chat-id "${process.env.LARK_NOTIFY_CHAT_ID}" --text "${text}"`, {
    encoding: 'utf-8',
    stdio: 'pipe'
  })
}
```

**接入点**：
- `POST /api/cards` — 创建卡片后
- `POST /api/cards/move` — 移动卡片后
- `PATCH /api/cards` — 状态更新为完成时

**环境变量**：
```bash
LARK_NOTIFY_CHAT_ID=oc_xxx
LARK_NOTIFY_ENABLED=true
```

---

### 4.2 看板数据导出到飞书多维表格 (Base)

**场景**：将看板的所有卡片数据同步到飞书多维表格，便于做数据透视、统计图表、跨项目汇总。

**Lark CLI 命令**：
```bash
# 1. 创建表格（如不存在）
lark-cli base tables create --app-token "APP_TOKEN" --name "Kanban 数据看板"

# 2. 批量写入记录
lark-cli base records batch-create --app-token "APP_TOKEN" --table-id "TABLE_ID" \
  --records '[{"fields":{"标题":"修复登录BUG","状态":"已完成","列表":"Done","标签":"Bug","创建时间":"2025-01-01"}}]'
```

**实现方式**：
新增 API 路由 `/api/sync/base`，支持手动触发或定时任务调用：

```typescript
// app/api/sync/base/route.ts
import { getAllBoards } from '@/lib/storage/StorageAdapter'
import { execSync } from 'child_process'

export async function POST() {
  const boards = await getAllBoards()
  const records = boards.flatMap(b => b.lanes.flatMap(l => l.cards.map(c => ({
    fields: {
      '标题': c.title,
      '描述': c.description || '',
      '列表': l.title,
      '看板': b.title,
      '标签': (c.tags || []).map(t => t.name).join(','),
      '位置': c.position,
      '创建时间': c.createdAt,
    }
  }))))

  // 分页批量写入（每次 500 条）
  const chunks = chunk(records, 500)
  for (const chunk of chunks) {
    execSync(`lark-cli base records batch-create ... --records '${JSON.stringify(chunk)}'`)
  }

  return Response.json({ success: true, count: records.length })
}
```

**扩展**：
- 使用 `lark-base` Skill 的视图能力，自动创建"按状态分组""按标签筛选"等视图
- 利用仪表盘功能生成燃尽图、累积流图

---

### 4.3 会议纪要待办自动生成看板卡片

**场景**：会议结束后，从飞书妙记/视频会议中提取待办事项，自动在看板"待办"列表中创建卡片。

**Lark CLI 命令**：
```bash
# 查询最近会议的待办产物
lark-cli minutes get-artifacts --minute-token "xxx" --artifact-type todos

# 或查询会议记录
lark-cli vc records search --start-time "2025-05-01T00:00:00Z" --end-time "2025-05-07T23:59:59Z"
lark-cli minutes get-artifacts --minute-token "xxx" --artifact-type summary,todos,chapters
```

**实现方式**：
新增脚本或 API `/api/sync/meetings`：

```typescript
// scripts/sync-meeting-todos.ts
import { execSync } from 'child_process'

function getRecentMeetingTodos() {
  const output = execSync(
    `lark-cli vc records search --start-time "${getStartOfWeek()}" --output json`,
    { encoding: 'utf-8' }
  )
  const records = JSON.parse(output)
  
  const todos: Array<{ content: string; assignee?: string }> = []
  for (const meeting of records) {
    const artifacts = execSync(
      `lark-cli minutes get-artifacts --minute-token "${meeting.minute_token}" --artifact-type todos --output json`,
      { encoding: 'utf-8' }
    )
    todos.push(...JSON.parse(artifacts).todos || [])
  }
  return todos
}

// 调用本地 API 创建卡片
for (const todo of todos) {
  await fetch('http://localhost:3000/api/cards', {
    method: 'POST',
    body: JSON.stringify({
      laneId: 'TODO_LANE_ID',
      title: todo.content,
      description: `来自会议待办${todo.assignee ? `，责任人: ${todo.assignee}` : ''}`
    })
  })
}
```

**定时执行**：通过 `node-cron` 或系统 cron 每小时执行一次脚本。

---

### 4.4 看板日报/周报自动生成飞书文档

**场景**：每日/每周自动汇总看板变动（新增卡片、完成卡片、进行中的卡片），生成飞书文档供团队查阅。

**Lark CLI 命令**：
```bash
lark-cli docs +create \
  --title "Kanban 周报 2025-W19" \
  --markdown "# 项目周报\n\n## 本周完成\n- ...\n\n## 进行中\n- ...\n\n## 新增事项\n- ..."
```

**实现方式**：
```typescript
// lib/lark/weekly-report.ts
import { execSync } from 'child_process'
import { getAllBoards } from '@/lib/storage/StorageAdapter'

export async function generateWeeklyReport() {
  const boards = await getAllBoards()
  const thisWeek = new Date()
  thisWeek.setDate(thisWeek.getDate() - 7)

  let md = `# Kanban 周报 (${formatDate(thisWeek)} - ${formatDate(new Date())})\n\n`

  for (const board of boards) {
    md += `## ${board.title}\n\n`
    const completed = board.lanes.flatMap(l => l.cards.filter(c => c.updatedAt > thisWeek.toISOString() && isDone(l.title)))
    const created = board.lanes.flatMap(l => l.cards.filter(c => c.createdAt > thisWeek.toISOString()))
    
    md += `### 本周完成 (${completed.length})\n`
    md += completed.map(c => `- [x] ${c.title}`).join('\n') || '无'
    md += `\n\n### 新增卡片 (${created.length})\n`
    md += created.map(c => `- [ ] ${c.title}`).join('\n') || '无'
    md += '\n\n'
  }

  const result = execSync(
    `lark-cli docs +create --title "Kanban 周报 ${getWeekNumber()}" --markdown "${md.replace(/"/g, '\\"')}" --output json`,
    { encoding: 'utf-8' }
  )
  return JSON.parse(result)
}
```

**扩展**：
- 生成后自动发送群消息通知：`lark-cli im +messages-send --chat-id xxx --text "周报已生成: ${docUrl}"`
- 支持写入 Wiki 知识库：`lark-cli wiki nodes create --space-id xxx --title ...`

---

### 4.5 飞书任务与看板卡片双向同步

**场景**：在飞书任务中创建的任务，同步到看板"待办"列表；在看板中完成的卡片，自动标记飞书任务完成。

**Lark CLI 命令**：
```bash
# 获取我的任务
lark-cli task +get-my-tasks --output json

# 创建任务
lark-cli task +create --summary "修复登录页样式" --description "看板卡片 #123" --output json

# 完成任务
lark-cli task +complete --task-id "xxx"
```

**映射设计**：
| 看板卡片 | 飞书任务 |
|---------|---------|
| `card.title` | `task.summary` |
| `card.description` | `task.description` |
| `lane.title` (Done) | `task.completed = true` |
| `card.createdAt` | `task.due?` |
| `card.id` | 存储在 `task.description` 或自定义字段 |

**实现方式**：
新增同步服务，维护 `data/task-sync-map.json`：
```json
{
  "task_mappings": [
    { "cardId": "card-123", "larkTaskId": "task-456", "lastSyncAt": "2025-05-06T10:00:00Z" }
  ]
}
```

定时双向比对差异并同步。

---

### 4.6 飞书机器人作为看板 AI 操控入口

**场景**：在飞书群聊中 @机器人，用自然语言操控看板，如"创建一个紧急 Bug 卡片到待修复列表"。

**架构**：
```
用户@机器人 → 飞书消息事件 → lark-cli event consume → 本地处理脚本 → 调用 /api/ai/tools/execute → 看板更新 → 回复飞书消息
```

**Lark CLI 命令**：
```bash
# 监听消息事件
lark-cli event consume "im.message.receive_v1" --max-events 100 --timeout 300
```

**实现方式**：
```typescript
// scripts/lark-bot-bridge.ts
import { spawn } from 'child_process'

const child = spawn('lark-cli', ['event', 'consume', 'im.message.receive_v1'], {
  stdio: ['ignore', 'pipe', 'pipe']
})

child.stdout.on('data', async (data) => {
  const lines = data.toString().trim().split('\n')
  for (const line of lines) {
    const event = JSON.parse(line)
    const userText = event.event.message.content.text
    const chatId = event.event.message.chat_id
    
    // 调用本地 AI 工具执行 API，复用现有 DeepSeek 工具系统
    const res = await fetch('http://localhost:3000/api/ai/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText })
    })
    const result = await res.json()
    
    // 回复飞书
    const reply = result.success 
      ? `✅ 已执行：${result.summary || '操作成功'}`
      : `❌ 执行失败：${result.error}`
      
    require('child_process').execSync(
      `lark-cli im +messages-send --chat-id "${chatId}" --text "${reply}"`
    )
  }
})
```

**优势**：
- 完全复用现有 `lib/ai-tools/` 系统，无需重写业务逻辑
- 多入口统一：Web 端聊天面板、飞书机器人共享同一套工具执行器

---

### 4.7 重要卡片变更飞书审批流

**场景**：涉及"删除看板""批量移动卡片到已完成"等敏感操作，先创建飞书审批，通过后才执行。

**Lark CLI 命令**：
```bash
# 创建审批实例
lark-cli approval +create-instance \
  --approval-code "APPROVAL_CODE" \
  --form '{"看板名称":"产品迭代看板","操作类型":"删除看板","申请人":"张三"}'

# 查询审批任务状态
lark-cli approval +get-tasks --instance-code "INSTANCE_CODE" --output json
```

**实现方式**：
在敏感 API 前增加审批中间件：

```typescript
// middleware/lark-approval.ts
import { execSync } from 'child_process'

export async function requireApproval(req: Request, action: string) {
  if (!process.env.LARK_APPROVAL_ENABLED) return true

  const instance = execSync(
    `lark-cli approval +create-instance --approval-code "${process.env.LARK_APPROVAL_CODE}" --form '${JSON.stringify({ action })}' --output json`,
    { encoding: 'utf-8' }
  )
  const { instance_code } = JSON.parse(instance)
  
  // 存入待审批队列，等待 webhook 回调或轮询
  await savePendingApproval({ instanceCode: instance_code, requestBody: req.body })
  
  return { pending: true, instanceCode: instance_code }
}
```

**扩展**：
- 审批通过后，通过 `lark-cli event consume` 监听 `approval.instance.status_change` 事件，自动执行原请求

---

## 5. 技术实现架构

### 5.1 新增模块建议

```
lib/
├── lark/
│   ├── client.ts          # Lark CLI 封装（exec 调用 + 错误处理 + dry-run 支持）
│   ├── notifier.ts        # 消息通知服务
│   ├── base-sync.ts       # 多维表格同步逻辑
│   ├── report-generator.ts # 文档/周报生成器
│   └── bot-bridge.ts      # 飞书事件桥接
├── hooks/
│   └── useLarkSync.ts     # 前端同步状态 Hook
app/
├── api/
│   ├── sync/
│   │   ├── base/route.ts      # POST /api/sync/base
│   │   ├── meetings/route.ts  # POST /api/sync/meetings
│   │   └── report/route.ts    # POST /api/sync/report
│   └── webhooks/
│       └── lark/route.ts      # 接收飞书事件推送（可选）
scripts/
├── sync-base.ts           # 定时同步多维表格
├── sync-meetings.ts       # 定时同步会议待办
└── lark-bot-bridge.ts     # 飞书机器人常驻进程
```

### 5.2 统一 CLI 调用封装

```typescript
// lib/lark/client.ts
import { execSync, exec } from 'child_process'

interface LarkCliOptions {
  dryRun?: boolean
  output?: 'json' | 'table' | 'pretty'
  as?: 'bot' | 'user'
}

export class LarkClient {
  constructor(private defaultOptions: LarkCliOptions = {}) {}

  run(command: string, options: LarkCliOptions = {}): string {
    const opts = { ...this.defaultOptions, ...options }
    const args = [
      opts.dryRun ? '--dry-run' : '',
      opts.output ? `--output ${opts.output}` : '--output json',
      opts.as ? `--as ${opts.as}` : '',
      command
    ].filter(Boolean).join(' ')

    const fullCmd = `lark-cli ${args}`
    
    if (opts.dryRun) {
      console.log('[Lark CLI Dry Run]', fullCmd)
      return ''
    }

    try {
      return execSync(fullCmd, { encoding: 'utf-8', stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 })
    } catch (error: any) {
      console.error('Lark CLI 执行失败:', error.stderr || error.message)
      throw new Error(`Lark CLI failed: ${error.stderr || error.message}`)
    }
  }

  async runAsync(command: string, options?: LarkCliOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const opts = { ...this.defaultOptions, ...options }
      const args = `lark-cli ${opts.dryRun ? '--dry-run ' : ''}${command}`
      exec(args, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message))
        else resolve(stdout)
      })
    })
  }
}

export const lark = new LarkClient({ output: 'json', as: 'bot' })
```

### 5.3 环境变量配置

```bash
# .env
# Lark CLI 集成开关
LARK_INTEGRATION_ENABLED=true

# 通知配置
LARK_NOTIFY_ENABLED=true
LARK_NOTIFY_CHAT_ID=oc_xxx

# 多维表格配置
LARK_BASE_APP_TOKEN=app-xxx
LARK_BASE_TABLE_ID=tbl-xxx
LARK_BASE_SYNC_ENABLED=true

# 审批配置
LARK_APPROVAL_ENABLED=false
LARK_APPROVAL_CODE=APPROVAL_CODE

# 周报配置
LARK_WEEKLY_REPORT_ENABLED=true
LARK_WEEKLY_REPORT_FOLDER_TOKEN=fold-xxx

# 机器人桥接
LARK_BOT_BRIDGE_ENABLED=false
```

---

## 6. 实施优先级建议

| 优先级 | 场景 | 工作量 | 价值 | 建议阶段 |
|--------|------|--------|------|---------|
| P0 | **变更通知 → 飞书群聊** | 低（1-2 天） | 高 | 立即实施 |
| P0 | **看板数据 → 多维表格** | 中（3-5 天） | 高 | 第一周 |
| P1 | **会议纪要 → 看板卡片** | 中（3-5 天） | 高 | 第二周 |
| P1 | **日报/周报 → 飞书文档** | 中（2-4 天） | 中高 | 第二周 |
| P2 | **飞书机器人操控看板** | 中高（5-7 天） | 高 | 第三周 |
| P2 | **卡片 ↔ 任务双向同步** | 中高（5-7 天） | 中 | 第三~四周 |
| P3 | **审批流集成** | 高（7-10 天） | 中 | 后续迭代 |

---

## 7. 附录：常用 Lark CLI 命令参考

### 7.1 安装与初始化

```bash
# 安装 CLI 和 Skills
npm install -g @larksuite/cli
npx skills add larksuite/cli -y -g

# 配置与登录
lark-cli config init
lark-cli auth login --recommend
lark-cli auth status
lark-cli doctor
```

### 7.2 即时通讯

```bash
# 发送文本消息
lark-cli im +messages-send --chat-id "oc_xxx" --text "Hello"

# 发送富文本
lark-cli im +messages-send --chat-id "oc_xxx" --content '{"text":"Hello"}'

# 搜索消息
lark-cli im +messages-search --query "项目进度" --output json
```

### 7.3 文档

```bash
# 创建 Markdown 文档
lark-cli docs +create --title "周报" --markdown "# 标题\n内容"

# 获取文档内容
lark-cli docs +fetch --document-id "xxx" --output markdown

# 更新文档
lark-cli docs +update --document-id "xxx" --markdown "# 更新后内容"
```

### 7.4 多维表格

```bash
# 列出表格
lark-cli base tables list --app-token "APP_TOKEN" --output json

# 查询记录
lark-cli base records query --app-token "APP_TOKEN" --table-id "TABLE_ID" --output json

# 批量创建
lark-cli base records batch-create --app-token "APP_TOKEN" --table-id "TABLE_ID" --records '[...]'

# 批量更新
lark-cli base records batch-update --app-token "APP_TOKEN" --table-id "TABLE_ID" --records '[...]'
```

### 7.5 任务

```bash
# 获取我的任务
lark-cli task +get-my-tasks --output json

# 创建任务
lark-cli task +create --summary "任务标题" --description "详情" --due "2025-05-10"

# 完成任务
lark-cli task +complete --task-id "xxx"
```

### 7.6 会议与妙记

```bash
# 搜索会议记录
lark-cli vc records search --start-time "2025-05-01T00:00:00Z" --output json

# 获取会议纪要产物
lark-cli minutes get-artifacts --minute-token "xxx" --artifact-type summary,todos --output json
```

### 7.7 审批

```bash
# 创建审批实例
lark-cli approval +create-instance --approval-code "xxx" --form '{"key":"value"}'

# 查询我的待办
lark-cli approval +get-tasks --output json
```

### 7.8 事件监听

```bash
# 监听消息事件
lark-cli event consume "im.message.receive_v1" --max-events 50 --timeout 300

# 监听审批状态变更
lark-cli event consume "approval.instance.status_change" --max-events 10
```

---

## 参考链接

- [Lark CLI 官方文档](https://open.larksuite.com/document/mcp_open_tools/feishu-cli-let-ai-actually-do-your-work-in-feishu)
- [Lark CLI GitHub](https://github.com/larksuite/cli)
- [Lark MCP vs CLI 对比](https://www.verdent.ai/guides/lark-mcp-vs-lark-cli-ai-dev-workflow)
- 本项目 [AI Tools System](ai-tools-system.md)
- 本项目 [API Routes](api-routes.md)

---

*最后更新: 2026-05-06*
