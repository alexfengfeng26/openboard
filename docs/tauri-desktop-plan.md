# Tauri 2.0 桌面端打包方案

将 kanban-board 从 Web 应用迁移为跨平台桌面应用（Windows / macOS）。

---

## 一、方案概述

### 目标

利用 **Tauri 2.0** 框架，将现有的 Next.js 16 + React 19 看板系统打包为原生桌面应用，支持 **Windows** 和 **macOS** 平台。用户无需部署服务器或配置 Node.js 环境，双击即可运行。

### 核心思路

- **前端保留**：Next.js 前端代码几乎零改动，仅将 SSR 模式切换为 **静态导出（SSG）**
- **后端替换**：移除 Next.js API Routes（Node.js 运行时），用 **Tauri Commands（Rust IPC）** 替代
- **存储升级**：将 Markdown 文件存储从项目目录的 `data/` 迁移到 **操作系统标准的应用数据目录**
- **AI 保留**：DeepSeek API 调用直接从前端通过 HTTP 发出（Tauri 提供网络权限），或包装为 Tauri HTTP 命令

### 预期收益

| 维度 | Web 版现状 | 桌面版预期 |
|------|-----------|-----------|
| 部署成本 | 需 Node.js 服务器 + 环境配置 | 双击 `.exe` / `.app` 运行 |
| 安装包体积 | 依赖 Next.js 运行时（~200MB+） | Tauri 原生二进制（~15-30MB） |
| 运行时内存 | Node.js + Chromium（~300MB+） | WebView + Rust（~50-80MB） |
| 数据存储 | 项目目录 `data/` | 系统应用数据目录，多用户隔离 |
| 离线能力 | 必须联网（除本地服务器） | 完全离线可用 |
| 自动更新 | 需手动部署 | 集成 Tauri Updater |

---

## 二、架构对比

### 当前 Web 架构

```
┌─────────────────────────────────────────┐
│  Browser                                │
│  ┌─────────────────────────────────┐   │
│  │  Next.js Frontend (React 19)    │   │
│  │  ├─ App Router (Client Comp)   │   │
│  │  ├─ BoardClient (Drag & Drop)  │   │
│  │  └─ DeepSeekChatPanel (AI)     │   │
│  └─────────────┬───────────────────┘   │
│                │ HTTP /fetch            │
│  ┌─────────────▼───────────────────┐   │
│  │  Next.js API Routes (Node.js)   │   │
│  │  ├─ /api/boards/*               │   │
│  │  ├─ /api/cards/*                │   │
│  │  ├─ /api/ai/chat                │   │
│  │  └─ /api/ai/tools/execute       │   │
│  └─────────────┬───────────────────┘   │
│                │ Node.js fs            │
│  ┌─────────────▼───────────────────┐   │
│  │  data/*.md (Markdown Storage)   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Tauri 桌面架构

```
┌─────────────────────────────────────────┐
│  Native Window (WebView2 / WebKit)      │
│  ┌─────────────────────────────────┐   │
│  │  Next.js Frontend (SSG Export)  │   │
│  │  ├─ BoardClient (Drag & Drop)  │   │
│  │  ├─ DeepSeekChatPanel (AI)     │   │
│  │  └─ Tauri API Adapter Layer     │   │
│  └─────────────┬───────────────────┘   │
│                │ IPC (invoke)           │
│  ┌─────────────▼───────────────────┐   │
│  │  Tauri Core (Rust)              │   │
│  │  ├─ Commands: board, card, lane │   │
│  │  ├─ Commands: ai_proxy, export  │   │
│  │  ├─ File System Plugin          │   │
│  │  └─ HTTP Client (optional)      │   │
│  └─────────────┬───────────────────┘   │
│                │ OS Native APIs         │
│  ┌─────────────▼───────────────────┐   │
│  │  AppLocalData/*.md              │   │
│  │  (OS-standard app data dir)     │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## 三、技术方案

### 3.1 前端适配：Next.js 静态导出

Tauri 2.0 **不支持 Node.js 服务端运行时**，因此必须将 Next.js 切换为纯静态导出模式。

#### 配置变更 (`next.config.ts`)

```typescript
const isProd = process.env.NODE_ENV === 'production'
const internalHost = process.env.TAURI_DEV_HOST || 'localhost'

const nextConfig = {
  // 强制静态导出，禁用 SSR
  output: 'export',
  
  // Image 组件需要关闭优化（SSG 模式不支持自动优化）
  images: {
    unoptimized: true,
  },
  
  // 开发模式下指定 assetPrefix，确保 Tauri WebView 正确加载资源
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
  
  // 保留现有配置...
}
```

#### 影响评估

| 现有功能 | 影响程度 | 处理方式 |
|---------|---------|---------|
| `app/page.tsx`（服务端获取看板列表） | ⚠️ 需改造 | 改为客户端 `useEffect` + Tauri Command 获取 |
| `app/layout.tsx` | ✅ 无影响 | 纯布局组件，无需改动 |
| `components/board/BoardClient.tsx` | ✅ 无影响 | 已是客户端组件 |
| `components/ai/DeepSeekChatPanel.tsx` | ⚠️ 需改造 | API 调用地址从 `/api/ai/*` 改为 Tauri Command 或直调 DeepSeek |
| Next.js Image 组件 | ⚠️ 需确认 | 设置 `unoptimized: true`，或替换为原生 `img` |
| `public/` 静态资源 | ✅ 无影响 | 静态导出自动包含 |

#### 关键改造点：移除服务端数据获取

当前 `app/page.tsx` 在服务端获取看板数据：

```typescript
// 当前（Web 版）
export default async function HomePage() {
  const boards = await getBoards() // 服务端调用
  return <BoardClient initialBoards={boards} />
}
```

改为客户端获取：

```typescript
// 桌面版
'use client'
export default function HomePage() {
  const [boards, setBoards] = useState([])
  useEffect(() => {
    // 通过 Tauri IPC 获取
    invoke('get_boards').then(setBoards)
  }, [])
  return <BoardClient initialBoards={boards} />
}
```

> **方案决策**：页面首次加载时数据获取延迟增加（从服务端直读变为 IPC 往返），但 Tauri IPC 本地通信延迟极低（< 5ms），用户感知不明显。

---

### 3.2 后端迁移：API Routes → Tauri Commands

将现有 20+ 个 Next.js API Route 映射为 Rust Tauri Commands。前端通过 `@tauri-apps/api/core` 的 `invoke()` 调用。

#### 通信层设计

```
前端 (TypeScript)          Tauri (Rust)
     │                          │
     ├─ invoke('get_boards') ──►├─ command handler
     │◄── { boards: Vec<Board> }┤
     │                          │
     ├─ invoke('create_card', {board_id, lane_id, title})
     │─────────────────────────►├─ command handler
     │◄── { card: Card }        ┤
     │                          │
     └─ invoke('ai_chat', {messages, model})
     ──────────────────────────►├─ HTTP proxy to DeepSeek
                                │◄── DeepSeek API Response
     ◄──────────────────────────┤
```

#### Command 映射表

| Next.js API Route | Tauri Command | Rust 侧职责 |
|-------------------|---------------|-------------|
| `GET /api/boards` | `get_boards` | 读取 `_boards.json` 索引 |
| `POST /api/boards` | `create_board` | 生成 ID，写 Markdown 文件，更新索引 |
| `GET /api/boards/[id]` | `get_board` | 读取 Markdown 文件 |
| `PATCH /api/boards/[id]` | `update_board` | 更新 Markdown frontmatter |
| `DELETE /api/boards/[id]` | `delete_board` | 删除文件，更新索引 |
| `POST /api/lanes` | `create_lane` | 修改 board Markdown |
| `POST /api/lanes/reorder` | `reorder_lanes` | 修改 board Markdown |
| `POST /api/cards` | `create_card` | 修改 board Markdown |
| `PATCH /api/cards` | `update_card` | 修改 board Markdown |
| `POST /api/cards/move` | `move_card` | 修改 board Markdown |
| `POST /api/cards/reorder` | `reorder_cards` | 修改 board Markdown |
| `POST /api/cards/batch-move` | `batch_move_cards` | 批量修改 board Markdown |
| `POST /api/cards/batch-delete` | `batch_delete_cards` | 批量修改 board Markdown |
| `POST /api/tags` | `update_tags` | 修改 board frontmatter |
| `POST /api/ai/chat` | `ai_chat_proxy` | 转发到 DeepSeek API（可选） |
| `GET/POST /api/settings/*` | `get_settings` / `save_settings` | 读写 `settings.json` |

#### Rust 层存储实现策略

**方案 A：复用 TypeScript 存储逻辑（推荐，快速落地）**

通过 Tauri 的 `Sidecar` 或 `Command` 调用 Node.js 脚本来复用现有的 `StorageAdapter`。

> 不推荐。引入 Node.js 侧car 会失去 Tauri 轻量化的核心优势。

**方案 B：Rust 重写存储层（推荐，长期最优）**

在 Rust 侧实现与 `lib/storage/` 等价的存储逻辑：

```rust
// src-tauri/src/storage/mod.rs
use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

pub struct StorageAdapter {
    data_dir: PathBuf,
    cache: BoardCache,
    lock: FileLock,
}

impl StorageAdapter {
    pub fn new(app_handle: &AppHandle) -> Self {
        let data_dir = app_handle.path().app_local_data_dir().unwrap().join("data");
        fs::create_dir_all(&data_dir).unwrap();
        Self { data_dir, cache: BoardCache::new(), lock: FileLock::new() }
    }
    
    pub fn get_board(&self, board_id: &str) -> Result<Board, StorageError> {
        // 1. 读缓存
        if let Some(board) = self.cache.get(board_id) {
            return Ok(board);
        }
        // 2. 读文件
        let path = self.data_dir.join(format!("{}.md", board_id));
        let content = fs::read_to_string(&path)?;
        let board = MarkdownBoard::parse(&content)?;
        // 3. 写缓存
        self.cache.set(board_id.to_string(), board.clone());
        Ok(board)
    }
    
    pub fn save_board(&self, board: &Board) -> Result<(), StorageError> {
        let path = self.data_dir.join(format!("{}.md", board.id));
        self.lock.acquire(&board.id)?;
        let content = MarkdownBoard::serialize(board)?;
        fs::write(&path, content)?;
        self.cache.set(board.id.clone(), board.clone());
        self.lock.release(&board.id)?;
        Ok(())
    }
}
```

**依赖的 Rust Crate**：
- `serde` / `serde_yaml` / `serde_json` — 序列化
- `gray_matter`（或自研 YAML frontmatter 解析器）— Markdown 解析
- `chrono` — 时间处理
- `parking_lot` 或 `tokio::sync` — 并发锁

#### 数据迁移

首次启动桌面应用时，将现有 `data/` 目录的 Markdown 文件迁移到系统应用数据目录：

```rust
#[tauri::command]
fn migrate_data(app_handle: AppHandle) -> Result<(), String> {
    let app_data = app_handle.path().app_local_data_dir().unwrap();
    let data_dir = app_data.join("data");
    
    // 检测是否需要迁移（首次运行）
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
        
        // 复制内置默认看板模板
        let default_board = include_str!("../default-board.md");
        fs::write(data_dir.join("default-board.md"), default_board)
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

---

### 3.3 存储层迁移：本地文件系统

#### 目录结构设计

Tauri 提供标准化的应用目录 API，推荐映射如下：

| 原 Web 路径 | 桌面版 Tauri 路径 | 获取方式 |
|------------|------------------|---------|
| `data/*.md` | `~/AppData/Local/kanban-board/data/*.md` (Win) | `app_local_data_dir()` |
| `data/settings.json` | `~/AppData/Local/kanban-board/settings.json` | `app_local_data_dir()` |
| `data/chat-history/*.json` | `~/AppData/Local/kanban-board/chat-history/*.json` | `app_local_data_dir()` |
| `public/attachments/` | `~/AppData/Local/kanban-board/attachments/` | `app_local_data_dir()` |
| 日志文件 | `~/AppData/Local/kanban-board/logs/` | `app_log_dir()` |

**Windows**: `%LOCALAPPDATA%\com.kanban-board.app\data\`
**macOS**: `~/Library/Application Support/com.kanban-board.app/data/`

#### Tauri 文件系统权限配置

```json
// src-tauri/capabilities/main.json
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "fs:default",
    "fs:allow-app-local-data-read",
    "fs:allow-app-local-data-write",
    "fs:allow-app-config-read",
    "fs:allow-app-config-write",
    "fs:allow-app-log-write",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$APPDATA/**/*" },
        { "path": "$APPLOCALDATA/**/*" }
      ]
    }
  ]
}
```

---

### 3.4 AI 集成调整

当前 Web 版通过 Next.js API Route (`/api/ai/chat`) 转发 DeepSeek 请求，主要目的是**隐藏 API Key**（存储在服务端环境变量）。

桌面版有三种策略可选：

#### 策略 A：前端直调 DeepSeek（最简单，API Key 暴露）

```typescript
// 前端直接调用
const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${apiKey}` } // Key 存储在前端
})
```

- ✅ 无需 Rust 后端参与
- ❌ API Key 以明文存储在客户端，存在泄露风险

#### 策略 B：Rust 代理层（推荐，兼顾安全与简洁）

```rust
// src-tauri/src/ai.rs
use reqwest;

#[tauri::command]
async fn ai_chat_proxy(
    messages: Vec<Message>,
    model: String,
    api_key: String, // 从应用配置读取
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.deepseek.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({ model, messages }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string())
}
```

- API Key 存储在 Rust 侧（应用配置加密存储），前端不可直接读取
- 仍可被逆向工程提取，但比前端明文安全一个数量级

#### 策略 C：本地 AI 模型（可选，完全离线）

桌面端可集成本地 LLM（如 Ollama、llama.cpp），通过 Rust 调用或 Sidecar 方式运行。

> 本阶段暂不考虑，作为未来扩展方向。

**决策**：采用 **策略 B**，在 Rust 层做 DeepSeek 代理，API Key 通过应用设置界面配置并存储于系统 Keychain（Tauri `shell` / `stronghold` 插件）。

---

### 3.5 设置系统迁移

当前 `data/settings.json` 服务端存储改为 Tauri 应用配置存储：

```rust
// 读取设置
#[tauri::command]
fn get_settings(app_handle: AppHandle) -> Result<AppSettings, String> {
    let config_path = app_handle.path().app_config_dir().unwrap().join("settings.json");
    let content = fs::read_to_string(&config_path).unwrap_or_default();
    let settings: AppSettings = serde_json::from_str(&content)
        .unwrap_or_else(|_| AppSettings::default());
    Ok(settings)
}

// 保存设置
#[tauri::command]
fn save_settings(app_handle: AppHandle, settings: AppSettings) -> Result<(), String> {
    let config_path = app_handle.path().app_config_dir().unwrap().join("settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}
```

---

## 四、项目结构变化

### 迁移后的目录结构

```
kanban-board/
├── src/                          # 前端源码（原项目根目录内容）
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── types/
│   ├── public/
│   └── ...                       # 原项目文件基本不变
├── src-tauri/                    # 新增：Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs               # 应用入口，注册 Commands
│   │   ├── commands/             # Tauri Commands
│   │   │   ├── board.rs          # 看板 CRUD
│   │   │   ├── card.rs           # 卡片操作
│   │   │   ├── lane.rs           # 列表操作
│   │   │   ├── ai.rs             # AI 代理
│   │   │   ├── settings.rs       # 设置读写
│   │   │   └── export.rs         # 导出/导入
│   │   ├── storage/              # Rust 存储层
│   │   │   ├── mod.rs
│   │   │   ├── adapter.rs        # StorageAdapter
│   │   │   ├── markdown.rs       # MarkdownBoard 解析/序列化
│   │   │   ├── cache.rs          # BoardCache (LRU)
│   │   │   ├── lock.rs           # FileLock
│   │   │   └── models.rs         # Board/Lane/Card 结构体
│   │   └── lib.rs
│   ├── capabilities/             # 权限声明
│   │   └── main.json
│   ├── icons/                    # 应用图标
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
├── data/                         # 开发时测试数据（可选）
├── next.config.ts                # 修改：添加 output: 'export'
├── package.json                  # 修改：添加 tauri 脚本
└── docs/
```

---

## 五、开发工作流

### 环境准备

```bash
# 1. 安装 Rust（如未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. 安装 Tauri CLI
cargo install tauri-cli --version "^2.0.0" --locked

# 3. 初始化 Tauri（在项目根目录）
cargo tauri init
# 按提示配置：
# - app name: kanban-board
# - window title: Kanban Board
# - frontend dist: ../out
# - dev server: http://localhost:3000
# - dev command: pnpm dev
# - build command: pnpm build
```

### 开发命令

```json
// package.json 新增脚本
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",       // 开发模式（热重载）
    "tauri:build": "tauri build"    // 生产构建
  }
}
```

```bash
# 开发模式：同时启动 Next.js dev server 和 Tauri 窗口
pnpm tauri:dev

# 生产构建：静态导出 + Rust 编译 + 打包
pnpm tauri:build
# 输出：
# - src-tauri/target/release/bundle/msi/*.msi        (Windows 安装包)
# - src-tauri/target/release/bundle/nsis/*.exe       (Windows 便携包)
# - src-tauri/target/release/bundle/dmg/*.dmg        (macOS 安装包)
```

---

## 六、构建与打包

### Tauri 构建配置 (`tauri.conf.json`)

```json
{
  "productName": "Kanban Board",
  "identifier": "com.kanban-board.app",
  "version": "1.0.0",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:3000",
    "frontendDist": "../out"
  },
  "app": {
    "windows": [
      {
        "title": "Kanban Board",
        "width": 1400,
        "height": 900,
        "minWidth": 800,
        "minHeight": 600,
        "center": true,
        "decorations": true,
        "transparent": false
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis", "dmg"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      }
    },
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13"
    }
  }
}
```

### 平台特定注意事项

#### Windows

- **WebView2**：Tauri 使用系统 Edge WebView2。Windows 10/11 通常已预装，旧版本需自动下载（`downloadBootstrapper`）
- **文件路径**：Rust `std::path` 自动处理，无需额外代码
- **安装包**：MSI（标准安装）或 NSIS（便携版）

#### macOS

- **签名与公证**：分发前需 Apple Developer 账号进行代码签名和公证，否则 Gatekeeper 会拦截
- **沙盒**：macOS App Sandbox 限制文件访问，需正确配置 `entitlements`
- **架构**：需分别构建 `x86_64` 和 `aarch64`（Apple Silicon），或使用 `universal-apple-darwin` 统一二进制

```xml
<!-- src-tauri/entitlements.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
  </dict>
</plist>
```

---

## 七、跨平台差异处理

| 差异点 | Windows | macOS | 处理策略 |
|--------|---------|-------|---------|
| 数据目录 | `%LOCALAPPDATA%` | `~/Library/Application Support` | Tauri `app_local_data_dir()` 自动适配 |
| 换行符 | `\r\n` | `\n` | Markdown 序列化统一使用 `\n` |
| 文件路径分隔符 | `\` | `/` | Rust `PathBuf` 自动处理 |
| 窗口控制按钮 | 右侧 | 左侧 | Tauri 自动适配系统样式 |
| 代码签名 | 可选（推荐） | 必须（公证） | CI/CD 中配置签名证书 |
| 自动更新 | `.msi` / `.nsis` | `.dmg` | Tauri Updater 插件支持 |

---

## 八、自动更新机制

Tauri 内置 Updater 插件，支持静默检查和增量更新：

```rust
// main.rs
use tauri_plugin_updater::Builder;

fn main() {
    tauri::Builder::default()
        .plugin(Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```typescript
// 前端检查更新
import { check } from '@tauri-apps/plugin-updater'

async function checkUpdate() {
  const update = await check()
  if (update) {
    await update.downloadAndInstall()
    // 重启应用
    await relaunch()
  }
}
```

更新服务器可使用 GitHub Releases、静态文件服务器或 Tauri Cloud。

---

## 九、实施路线图

### Phase 1：基础设施搭建（Week 1）

- [ ] 安装 Rust 和 Tauri CLI 环境
- [ ] 在项目根目录执行 `cargo tauri init`
- [ ] 配置 `next.config.ts` 添加 `output: 'export'` 和 `images.unoptimized`
- [ ] 验证 `pnpm tauri:dev` 能正常启动空窗口
- [ ] 验证 Next.js 静态导出产物能在 Tauri 中正确渲染

### Phase 2：核心存储层移植（Week 2-3）

- [ ] 在 Rust 侧定义 Board/Lane/Card/Tag 等数据模型（`src-tauri/src/storage/models.rs`）
- [ ] 实现 Markdown frontmatter 解析器（YAML + Markdown body）
- [ ] 实现 `StorageAdapter`：get_board / save_board / get_boards / delete_board
- [ ] 实现 `BoardCache`（LRU，max 50）
- [ ] 实现 `FileLock`（文件级并发锁）
- [ ] 注册首批 Tauri Commands：board CRUD
- [ ] 前端封装 `tauri-api.ts` 适配层（封装 invoke 调用）

### Phase 3：业务逻辑迁移（Week 3-4）

- [ ] 移植 lane 操作 Commands（create / update / delete / reorder）
- [ ] 移植 card 操作 Commands（create / update / delete / move / reorder / batch）
- [ ] 移植 settings Commands（get / save）
- [ ] 改造前端 page.tsx：从服务端获取改为客户端 invoke
- [ ] 改造前端 API 调用：从 `fetch('/api/...')` 改为 `invoke('...')`
- [ ] 实现附件上传/下载（使用 Tauri fs 插件操作本地文件）

### Phase 4：AI 与高级功能（Week 4-5）

- [ ] 实现 `ai_chat_proxy` Command（Rust 转发 DeepSeek）
- [ ] 改造 `DeepSeekChatPanel` 使用 Tauri Command 而非 HTTP API
- [ ] 实现导出/导入 Commands（JSON / CSV / Markdown）
- [ ] 实现操作日志持久化（看板 Markdown frontmatter）
- [ ] 配置 API Key 加密存储（Keychain / Credential Manager）

### Phase 5：打包与发布（Week 5-6）

- [ ] 配置应用图标（Windows `.ico` / macOS `.icns`）
- [ ] Windows 构建测试（`.msi` + `.exe`）
- [ ] macOS 构建测试（`.dmg`）
- [ ] 配置代码签名（Windows 证书 / Apple Developer）
- [ ] 配置 Tauri Updater
- [ ] GitHub Actions CI/CD 自动构建多平台安装包
- [ ] 编写用户安装指南

---

## 十、风险与缓解措施

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Next.js App Router 静态导出兼容性问题 | 中 | 高 | 提前在 Phase 1 验证所有页面能正确导出；`generateStaticParams` 处理动态路由 |
| Rust 重写存储层工作量大 | 高 | 中 | 分阶段实施，先保证读写基础功能；缓存和锁可后续优化 |
| Markdown frontmatter 解析与 TypeScript 侧行为不一致 | 中 | 高 | 建立统一测试用例（同一份 Markdown 在 TS 和 Rust 侧解析结果必须一致） |
| macOS 签名/公证流程阻塞发布 | 中 | 高 | 提前申请 Apple Developer 账号（$99/年）；Phase 5 早期即开始测试签名流程 |
| 前端 API 全面改造引入回归 Bug | 高 | 中 | 保持 `lib/api/` 抽象层，内部实现从 `fetch` 切换为 `invoke`，接口不变 |
| 拖放库 `@dnd-kit` 在 Tauri WebView 中异常 | 低 | 高 | Phase 1 即验证拖放功能；Tauri 使用系统 WebView（WebView2/WebKit），现代浏览器内核兼容性良好 |
| 用户数据迁移（从 `data/` 到系统目录） | 中 | 低 | 提供导出/导入功能；首次启动检测旧数据并提示迁移 |

---

## 十一、关键技术决策记录

### 决策 1：是否保留 Next.js？

- **选项 A**：保留 Next.js，切换为 SSG 导出
- **选项 B**：迁移为纯 React + Vite
- **决策**：保留 Next.js（选项 A）
- **理由**：现有代码量基于 Next.js App Router，迁移为 Vite 需要重写路由和文件结构，工作量巨大且易引入 Bug。静态导出模式改动面最小。

### 决策 2：Rust 侧存储层实现方式

- **选项 A**：复用 Node.js 侧car 调用现有 TypeScript 存储逻辑
- **选项 B**：Rust 重写存储层
- **决策**：Rust 重写（选项 B）
- **理由**：侧car 方案失去 Tauri 轻量化和安全性的核心优势，且打包复杂度上升。Rust 重写存储层工作量可控（Markdown 解析 + YAML + 文件 IO），长期收益更大。

### 决策 3：AI API Key 存储位置

- **选项 A**：前端明文存储（localStorage）
- **选项 B**：Rust 侧配置 + 系统 Keychain
- **选项 C**：用户每次手动输入
- **决策**：选项 B（Rust 侧 + Keychain）
- **理由**：完全离线不可行（需联网调用 DeepSeek），前端明文风险过高，每次输入体验太差。Rust 侧存储配合系统凭证管理是平衡点。

---

## 参考资源

- [Tauri 2.0 官方文档](https://v2.tauri.app/)
- [Tauri + Next.js 集成指南](https://v2.tauri.app/start/frontend/nextjs/)
- [Tauri 文件系统插件](https://v2.tauri.app/plugin/file-system/)
- [Tauri 更新插件](https://v2.tauri.app/plugin/updater/)
- [Next.js 静态导出文档](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
