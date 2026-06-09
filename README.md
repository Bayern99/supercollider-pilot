<![CDATA[# scctl — SuperCollider Agent Adapter

[![CI](https://github.com/Bayern99/New/actions/workflows/ci.yml/badge.svg)](https://github.com/Bayern99/New/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)

> 让 AI Coding Agent（Claude、Cursor、Windsurf 等）直接控制 SuperCollider 进行实时音频合成、生成音乐、声音设计。

**scctl** 是一个桥接层，将 [SuperCollider](https://supercollider.github.io/) 的 `sclang` 解释器包装为可被 AI Agent 调用的 MCP (Model Context Protocol) 工具服务器。它也可以作为独立 CLI 使用。

---

## Key Features

- 🔍 **自动发现** — 跨 macOS / Windows / Linux 自动检测 `sclang` 安装路径，包括系统 `PATH` 回退
- 🎛️ **进程管理** — 异步启动、代码求值、优雅关闭 + SIGKILL 兜底
- 🤖 **MCP 协议** — 暴露 `sc_check` / `sc_eval` / `sc_stop` 三个标准 MCP 工具，即插即用
- 💻 **CLI 工具** — `scctl check` 检查安装状态，`scctl run <file>` 执行 `.scd` 脚本
- 🛡️ **健壮性** — 并发执行锁、execute 超时（默认 120s）、信号处理（SIGINT/SIGTERM）、stdin/stdout/stderr 定界符解析
- ✅ **38 个自动化测试** — Vitest 全覆盖，含路径发现、进程控制、CLI 集成、MCP 协议

---

## Tech Stack

| 类别 | 技术 |
|------|------|
| **语言** | TypeScript 5 (ES Modules) |
| **运行时** | Node.js 22+ |
| **协议** | [Model Context Protocol (MCP)](https://modelcontextprotocol.io) |
| **CLI 框架** | [Commander.js](https://github.com/tj/commander.js) 11 |
| **MCP SDK** | `@modelcontextprotocol/sdk` 0.6 |
| **测试** | [Vitest](https://vitest.dev) 4 |
| **被控软件** | [SuperCollider](https://supercollider.github.io/) (sclang) |

---

## Prerequisites

在开始之前，确保你的系统安装了以下软件：

| 软件 | 最低版本 | 安装方式 |
|------|---------|---------|
| **Node.js** | 22+ | [nodejs.org](https://nodejs.org) 或 `brew install node` |
| **SuperCollider** | 3.13+ | [supercollider.github.io](https://supercollider.github.io/downloads) |
| **npm** | 随 Node.js 附带 | — |

> [!NOTE]
> SuperCollider 需要安装在默认路径（见下方「平台路径」一节），或确保 `sclang` 在系统 `PATH` 中。

### 平台默认路径

| 平台 | 预期路径 |
|------|---------|
| macOS | `/Applications/SuperCollider.app/Contents/MacOS/sclang` |
| Windows | `C:\Program Files\SuperCollider\sclang.exe` |
| Linux | `/usr/bin/sclang` 或 `/usr/local/bin/sclang` |

如果 `sclang` 不在上述路径，scctl 会自动扫描系统 `PATH` 环境变量进行查找。

---

## Getting Started

### 1. 克隆仓库

```bash
git clone https://github.com/Bayern99/New.git
cd New
```

### 2. 安装依赖

```bash
npm install
```

### 3. 构建项目

```bash
npm run build
```

### 4. 验证安装

```bash
node ./dist/cli.js check
```

如果 SuperCollider 已正确安装，你将看到：

```
STATUS: OK
PATH: /Applications/SuperCollider.app/Contents/MacOS/sclang
```

---

## Architecture

### 目录结构

```
super/
├── docs/
│   └── design/
│       └── control-approach-notes.md  # 架构讨论背景
├── src/
│   ├── cli.ts                  # Commander CLI 入口 (check / run)
│   ├── runtime/
│   │   ├── discover.ts         # 跨平台 sclang 路径自动发现
│   │   └── sclang.ts           # SclangController 进程生命周期管理
│   └── mcp/
│       └── server.ts           # MCP Server 工具注册与信号处理
├── tests/
│   ├── sanity.test.ts          # 基础健全性测试
│   ├── cli.test.ts             # CLI 集成测试
│   ├── runtime/
│   │   ├── discover.test.ts    # 路径发现单元测试
│   │   └── sclang.test.ts      # 进程控制 mock 测试
│   └── mcp/
│       └── server.test.ts      # MCP 协议与工具路由测试
├── play-music.js               # 示例：实时播放生成音乐
├── record-music.js             # 示例：录制音乐到 WAV 文件
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 数据流

```
┌─────────────────────────────────────────────────────────────┐
│  AI Agent (Claude Desktop / Cursor / 任意 MCP Client)        │
│                                                             │
│  调用 MCP 工具: sc_check / sc_eval / sc_stop                 │
└────────────────────────┬────────────────────────────────────┘
                         │ JSON-RPC over stdio
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  MCP Server (src/mcp/server.ts)                             │
│                                                             │
│  ┌─────────────────┐ ┌──────────────────────────────────┐   │
│  │ Tool Registry   │ │ Lifecycle: signal handlers,      │   │
│  │ sc_check        │ │ graceful shutdown, error recovery │   │
│  │ sc_eval         │ └──────────────────────────────────┘   │
│  │ sc_stop         │                                        │
│  └────────┬────────┘                                        │
└───────────┼─────────────────────────────────────────────────┘
            │ Singleton Instance
            ▼
┌─────────────────────────────────────────────────────────────┐
│  SclangController (src/runtime/sclang.ts)                   │
│                                                             │
│  boot() → spawn child process                               │
│  execute(code) → stdin write → stdout delimiter parse        │
│  stop() → CmdPeriod.run; Server.killAll; → SIGKILL fallback │
│                                                             │
│  ⚙️ 并发锁 │ 🕐 动态定界符 │ 🛡️ 错误边界                     │
└────────────────────────┬────────────────────────────────────┘
                         │ child_process.spawn
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  sclang (SuperCollider 解释器)                               │
│                                                             │
│  启动 scsynth → 音频合成引擎                                  │
│  执行 SC 代码 → 音频输出 / 文件录制                            │
└─────────────────────────────────────────────────────────────┘
```

### 核心设计决策

| 设计点 | 选择 | 理由 |
|--------|------|------|
| 进程通信 | stdin/stdout + 定界符 | sclang 原生支持管道式 REPL，无需额外依赖 |
| 并发控制 | `isExecuting` 互斥锁 | sclang 是单线程解释器，不支持并行求值 |
| 生命周期 | 单例 Controller | 避免多进程竞争音频设备 |
| 关闭策略 | 先发 SC 命令 → 超时后 SIGKILL | 优雅停止合成，兜底强杀 |

---

## Usage

### CLI 命令行

#### 检查 SuperCollider 安装

```bash
node ./dist/cli.js check
```

#### 执行 .scd 脚本文件

```bash
node ./dist/cli.js run path/to/your-script.scd
```

#### 全局安装后使用

```bash
npm link
scctl check
scctl run my-synth.scd
```

---

### MCP Server — 接入 AI Agent

这是 scctl 的核心用法：将 SuperCollider 作为 MCP 工具暴露给 AI Agent。

#### Claude Desktop 配置

编辑你的 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "supercollider": {
      "command": "node",
      "args": ["/absolute/path/to/super/dist/mcp/server.js"]
    }
  }
}
```

#### 暴露的 MCP 工具

| 工具名 | 参数 | 描述 |
|--------|------|------|
| `sc_check` | 无 | 检查 sclang 是否可用，返回安装路径 |
| `sc_eval` | `code: string` (必填) | 向 sclang 发送 SuperCollider 代码并返回执行结果 |
| `sc_stop` | 无 | 停止所有合成、释放音频资源、关闭 sclang 进程 |

#### 使用示例

配置完成后，你可以直接在 Claude Desktop 中对话：

> "帮我用 SuperCollider 生成一段五声音阶的琶音旋律"

Claude 会调用 `sc_eval` 工具，将生成的 SC 代码发送到 sclang 执行，你将听到实时音频输出。

---

## Security

`sc_eval` 可执行任意 SuperCollider 代码。SuperCollider 具有访问主机文件系统、启动子进程等能力，**没有沙箱限制**。

- 仅将 MCP Server 配置在**可信的本地 AI 客户端**（如 Claude Desktop、Cursor）中
- 不要将 MCP Server 暴露到公网或不受信任的网络环境
- 若 Agent 生成的代码不可信，请在隔离环境中运行

---

## Examples

### 实时播放生成音乐

```bash
node play-music.js
```

这个示例会：
1. 自动发现 sclang 路径
2. 启动 sclang 和音频服务器 (scsynth)
3. 定义一个温暖的锯齿波合成器
4. 播放五声音阶琶音模式 10 秒
5. 优雅关闭所有进程

### 录制到 WAV 文件

```bash
node record-music.js
```

这个示例会：
1. 启动音频合成引擎
2. 将输出录制到当前工作目录下的 `music.wav`
3. 播放 10 秒生成旋律
4. 停止录制并保存文件

### 编程接口

```javascript
import { SclangController } from './dist/runtime/sclang.js';
import { discoverSclangPath } from './dist/runtime/discover.js';

const path = discoverSclangPath();
const controller = new SclangController(path);

await controller.boot();

const result = await controller.execute(`
  s.boot;
  s.sync;
  { SinOsc.ar(440) * 0.1 }.play;
`);

console.log(result.output);
// { success: true, output: "..." }

await controller.stop();
```

---

## Testing

### 运行全部测试

```bash
npm test
```

### 运行特定测试

```bash
npx vitest run tests/runtime/discover.test.ts
npx vitest run tests/mcp/server.test.ts
```

### 监听模式

```bash
npm run test:watch
```

### 测试覆盖

```
 ✓ tests/runtime/sclang.test.ts     (13 tests)   25ms
 ✓ tests/sanity.test.ts             (1 test)       3ms
 ✓ tests/runtime/discover.test.ts   (6 tests)      6ms
 ✓ tests/mcp/server.test.ts         (15 tests)   121ms
 ✓ tests/cli.test.ts                (3 tests)   3334ms

 Test Files  5 passed (5)
      Tests  38 passed (38)
   Duration  3.59s
```

### 测试结构

| 测试文件 | 覆盖范围 |
|---------|---------|
| `tests/runtime/discover.test.ts` | 跨平台路径发现、PATH 回退、mock fs |
| `tests/runtime/sclang.test.ts` | 进程控制、并发锁、异常退出、信号处理 |
| `tests/cli.test.ts` | Commander 命令、check/run 集成、退出码 |
| `tests/mcp/server.test.ts` | MCP JSON-RPC schema、工具路由、输入验证 |
| `tests/sanity.test.ts` | 环境健全性检查 |

---

## Available Scripts

| 命令 | 描述 |
|------|------|
| `npm run build` | TypeScript 编译到 `dist/` |
| `npm test` | 运行全部 Vitest 测试 |
| `npm run test:watch` | 文件变更时自动重跑测试 |
| `node dist/cli.js check` | 检查 SuperCollider 安装 |
| `node dist/cli.js run <file>` | 执行 .scd 脚本 |
| `node dist/mcp/server.js` | 启动 MCP Server (stdio 模式) |

---

## Portability — 迁移到其他电脑

scctl 可以打包迁移到其他机器使用：

```bash
# 在目标机器上
cd New
npm install
npm run build
node dist/cli.js check
```

> [!IMPORTANT]
> 目标机器需要安装 **Node.js 22+** 和 **SuperCollider**。核心 runtime 使用动态路径发现 sclang；示例脚本将录制文件输出到 `process.cwd()/music.wav`。

---

## Troubleshooting

### sclang 未找到

**错误：** `STATUS: ERROR` / `sclang binary not found`

**解决方案：**

1. 确认 SuperCollider 已安装
2. 检查安装路径是否在默认位置
3. 或将 `sclang` 所在目录加入系统 `PATH`：
   ```bash
   export PATH="/path/to/SuperCollider/Contents/MacOS:$PATH"
   ```

### 音频服务器启动失败

**错误：** `Server 'localhost' not running`

**解决方案：**

1. 确保没有其他 SuperCollider 实例正在运行
2. 检查音频设备权限（macOS 需授予麦克风/音频权限）
3. 尝试先在 SuperCollider IDE 中手动启动 `s.boot` 验证

### 进程僵死

**错误：** 执行后程序挂起不退出

**解决方案：**

```bash
# 查找并杀死残留的 sclang/scsynth 进程
pkill -f sclang
pkill -f scsynth
```

scctl 内置了多层防护（SIGKILL 兜底、信号处理器），但极端情况下可能需要手动清理。

### 并发执行报错

**错误：** `Concurrent execution is not supported`

**说明：** sclang 是单线程解释器。scctl 强制串行执行以避免数据竞争。请等上一条命令完成后再发送下一条。

---

## How It Works — 技术细节

### stdin/stdout/stderr 定界符协议

scctl 通过定界符机制实现可靠的输出解析：

```
SC_EVAL_DONE_<timestamp>_<random>_OK    // 执行成功
SC_EVAL_DONE_<timestamp>_<random>_ERR   // 执行失败
```

每次 `execute()` 调用生成唯一定界符，通过 `wrapScCode()` 用**字符串拼接**（非 JS 模板字面量）将用户代码包装在 `try/catch` 中，避免注入风险。定界符同时监听 stdout 和 stderr。默认超时 120 秒，超时后 reject。

### 进程生命周期

```
boot()  →  spawn sclang -i scide  →  等待 1.5s 初始化
              ↓
execute()  →  stdin.write(wrappedCode + \x0c)  →  等待定界符（stdout/stderr，默认 120s 超时）
              ↓
stop()  →  reject 挂起的 execute  →  stdin.write("CmdPeriod.run; Server.killAll;")
              ↓  500ms timeout
           SIGKILL (强制终止兜底)  →  cleanupProcess()
```

---

## License

ISC
]]>
