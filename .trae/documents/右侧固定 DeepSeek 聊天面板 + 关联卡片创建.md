## 目标
- 在看板页面右侧加入一个固定的 DeepSeek AI 聊天窗口（桌面端常驻）。
- 聊天可“关联当前卡片上下文”，并能一键把 AI 结果生成卡片（或生成卡片草稿后再创建）。

## 现状调研结论
- 首页是 Server Component 取数后渲染客户端看板：[page.tsx](file:///d:/claude/kanban-board/app/page.tsx) → [BoardClient.tsx](file:///d:/claude/kanban-board/components/board/BoardClient.tsx)。
- 当前 UI 没有 Sidebar/Drawer 组件，交互主要是 Dialog/AlertDialog（创建/编辑卡片、创建/编辑列表）。
- 现有卡片 API：创建/更新/删除在 [api/cards/route.ts](file:///d:/claude/kanban-board/app/api/cards/route.ts)，移动在 [api/cards/move/route.ts](file:///d:/claude/kanban-board/app/api/cards/move/route.ts)。
- 发现一个与“关联卡片内容”相关的现有 Bug：更新/删除卡片的参数名在 UI 与 API 不一致（UI 用 cardId，API DELETE 取 id，PATCH 取 body.cardId）。会导致后续“AI 更新卡片/从卡片创建”不稳定，需要一并修正。

## UI 方案（右侧固定面板）
- 改造 [BoardClient.tsx](file:///d:/claude/kanban-board/components/board/BoardClient.tsx) 的布局：
  - 外层改为左右分栏：左侧为现有 header + 看板滚动区，右侧为固定宽度 aside（`w-[360px~420px]`，`border-l`，`bg-white/80 backdrop-blur`）。
  - 保持左侧看板横向滚动不受影响（左侧容器 `min-w-0 flex-1`）。
  - 移动端：右侧面板默认隐藏，在 header 放一个“Chat”按钮，用现有 Dialog 作为弹出聊天窗口（不引入新依赖）。

## 新增聊天组件（DeepSeekChatPanel）
- 新增组件：`components/ai/DeepSeekChatPanel.tsx`（Client Component）。核心能力：
  - 消息列表（user/assistant），输入框（Enter 发送，Shift+Enter 换行）。
  - 右上角提供 model 选择（如 `deepseek-chat` / `deepseek-reasoner`）与“清空会话”。
  - “关联卡片上下文”：
    - 当用户打开/编辑某张卡片时（BoardClient 已有 `editingCard` 状态），聊天面板显示“当前关联卡片：xxx”，并在发给 AI 的 system/context 中带上 `title/description/lane`。
  - “从 AI 创建卡片”两步流：
    1) 对最后一条 AI 回复点击“生成卡片草稿”（再次请求 AI 输出严格 JSON：`{ title, description }`，可选 `tags`）。
    2) 展示可编辑的草稿表单（标题/描述/目标列表下拉），点击“创建”调用现有 `/api/cards`，并通过回调把新卡片插入到对应 lane 的本地 state（无需刷新）。

## 新增服务端代理接口（避免暴露 Key）
- 新增路由：`app/api/ai/chat/route.ts`。
  - 从 `process.env.DEEPSEEK_API_KEY` 读取密钥。
  - 接收 `{ messages, model }`（messages 为 OpenAI 兼容结构）。
  - 转发到 DeepSeek OpenAI-compat endpoint（base：`https://api.deepseek.com`，path：`/chat/completions`），返回 assistant 文本。
  - 失败时返回可读错误（不打印/不返回 key）。
- 新增文档：补充 `.env.example` 或 README 增加 `DEEPSEEK_API_KEY=...` 说明。

## 修复现有卡片更新/删除参数不一致（顺带保证 AI 相关能力稳定）
- 修复 [api/cards/route.ts](file:///d:/claude/kanban-board/app/api/cards/route.ts)：
  - DELETE：同时接受 `id` 与 `cardId` query 参数。
  - PATCH：优先从 body 取 `cardId`，没有则从 query 取 `cardId/id`，从而兼容当前 UI。
- 同步修复 [EditCardDialog.tsx](file:///d:/claude/kanban-board/components/card/EditCardDialog.tsx)：
  - PATCH body 补上 `cardId`（或改为统一 query `id`），确保 API/前端一致。

## 验证方式
- 运行 `npm run build` 确认类型与构建通过。
- `npm run dev` 打开首页：
  - 右侧聊天面板固定显示；移动端可从按钮打开。
  - 发送消息能收到 DeepSeek 回复。
  - 在聊天里生成卡片草稿并创建后，新卡片即时出现在选定列表。
  - 打开某张卡片编辑时，聊天面板能显示关联卡片信息，并可基于该上下文提问。

## 交付物（预期改动文件）
- 更新：components/board/BoardClient.tsx
- 新增：components/ai/DeepSeekChatPanel.tsx
- 新增：app/api/ai/chat/route.ts
- 更新：app/api/cards/route.ts、components/card/EditCardDialog.tsx
- 新增/更新：.env.example 或 README.md（添加 DEEPSEEK_API_KEY 说明）