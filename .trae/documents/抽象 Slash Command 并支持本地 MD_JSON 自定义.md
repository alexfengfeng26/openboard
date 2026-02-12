## 目标
- 把当前聊天输入框的“/kb /card /lane /board + /模板”统一抽象为可配置的 Command。
- 允许你在设置里新增/编辑/删除 Command，并可导入/导出到本地文件（JSON 或 Markdown）。
- 保持现有行为：普通聊天不被工具调用打扰；输入前缀命令仍可触发卡片/列表/看板 CRUD；“/”补全菜单仍可用。

## 现状梳理
- 目前“/命令”由两部分硬编码生成：
  - 触发前缀：toolTriggerConfig.prefixes（/kb /card /lane /board），存在 localStorage（kanban.aiToolTriggerConfig.v1）。
  - 模板：quickTemplates（写死在组件里）。
- 项目里暂无现成的“导入/导出文件”实现；需要新增前端下载/上传逻辑。

## 设计：Command 数据模型
- 新增 Command 结构（建议放到 types 下）：
  - id: string
  - trigger: string（如 /card、/jira、/t1）
  - kind: 'tool' | 'snippet'
  - scope?: 'all' | 'card' | 'lane' | 'board'（kind=tool 时必填）
  - label: string（菜单展示用）
  - description?: string
  - insertText: string（选中后插入到输入框的内容，例："/card " 或一段模板文本）
  - enabled: boolean
- 存储：localStorage 保存 JSON（例如 key: kanban.aiCommands.v1）。

## 行为改造（核心）
1) Slash 菜单来源统一改为 commands（不再依赖 quickTemplates + prefixes 的硬编码拼装）。
2) 工具触发匹配（matchToolTrigger）改为：
   - 若 gateByPrefix=false：保持“随时可触发工具”（等价 scope=all）。
   - 若 gateByPrefix=true：仅当输入以某个 kind=tool 且 enabled 的 trigger 开头时才进入工具模式，并按 scope 限制可用工具。
3) 兼容迁移：
   - 若本地没有 commands，则从当前默认的 /kb /card /lane /board + 现有模板自动生成一份初始 commands 写入 localStorage。
   - 保留现有 toolTriggerConfig（gateByPrefix、是否显示按钮等）作为“触发策略/显示策略”，但“具体有哪些 / 命令”全部由 commands 决定。

## 设置页 UI（在现有齿轮弹窗里扩展）
- 新增“Commands 管理”区：
  - 列表展示：启用开关、trigger、类型(kind/scope)、label、insertText（可折叠）、操作（编辑/删除）。
  - “新增 Command”弹窗：表单校验 trigger 唯一、必须以 / 开头（可选规则）、tool 类型必须选 scope。
  - 内置命令策略（二选一，实施时择优）：
    - A：全部都可编辑/删除（最简单）
    - B：默认命令标记为 builtin，不允许删除但可禁用（更稳）

## 本地文件导入/导出（JSON & Markdown）
- 导出 JSON：将 commands 序列化为 JSON 文件并触发下载。
- 导入 JSON：上传文件，读取文本，解析为数组后校验并写入 localStorage。
- 导出 Markdown：生成一个 .md，内容包含说明 + 一个 ```json 代码块（内含 commands 数组）。
- 导入 Markdown：从 md 文本中提取 ```json 代码块并解析（无代码块时尝试整段 JSON）。

## 验证与回归
- 手动验证：
  - 输入“/”弹出菜单，能上下选择、Enter 插入。
  - 新增自定义 / 命令后，菜单可见且插入正确。
  - 自定义 tool 前缀可触发 CRUD 确认框，且 scope 限制生效（/card 不出现 lane/board 操作）。
  - 导出/导入 JSON/MD 后配置保持。
- 自动验证：保持现有 vitest 通过；如必要补充一个命令解析/导入导出的小单测。

## 交付物（改动点）
- 新增：Command 类型定义 + commands 持久化工具函数（load/save/validate/import/export）。
- 修改：DeepSeekChatPanel 的 slash menu 构建与 matchToolTrigger 逻辑改用 commands。
- 修改：设置弹窗 UI 增加 Commands 管理与导入/导出。

确认后我会按以上方案开始落地实现。