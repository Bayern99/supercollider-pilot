# supercollider-mcp

[English](README.md) | [简体中文](README.zh-CN.md)

**面向 AI Agent 的 SuperCollider MCP 服务**，附带 `scctl` 命令行工具。

[![CI](https://github.com/Bayern99/supercollider-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Bayern99/supercollider-mcp/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)

将 [SuperCollider](https://supercollider.github.io/) 的 `sclang` 封装为 [MCP](https://modelcontextprotocol.io) 服务（六个工具）及对应的 CLI：检查安装、执行 `.scd`、读取 post、录制 WAV、干净退出。

## 功能

- 跨平台发现 `sclang`（macOS、Windows、Linux，及 `PATH` 回退）
- 持久 `SclangController`，基于分隔符解析 stdout/stderr
- MCP：`sc_check`、`sc_eval`、`sc_run_file`、`sc_logs`、`sc_render`、`sc_stop`
- CLI：`scctl check`、`scctl run <file.scd>`、`scctl render <file.scd> -o out.wav`
- R1 录音包装：boot → 用户代码 → record → 等待 → stop → 校验 WAV
- SIGINT/SIGTERM 优雅退出；执行超时（默认 120s）
- Vitest 覆盖发现、运行时、CLI、MCP 路由

## 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | 22+ |
| SuperCollider | 3.13+（`sclang` 在 `PATH` 或默认安装路径） |

默认 `sclang` 路径：

| 平台 | 路径 |
|------|------|
| macOS | `/Applications/SuperCollider.app/Contents/MacOS/sclang` |
| Windows | `C:\Program Files\SuperCollider\sclang.exe` |
| Linux | `/usr/bin/sclang` 或 `/usr/local/bin/sclang` |

## 安装

```bash
git clone https://github.com/Bayern99/supercollider-mcp.git
cd supercollider-mcp
npm install
npm run build
```

验证 SuperCollider 是否可用：

```bash
node dist/cli.js check
```

已安装时的示例输出：

```text
STATUS: OK
PATH: /Applications/SuperCollider.app/Contents/MacOS/sclang
SERVER: not_running
```

## 使用

### CLI

```bash
# 检查安装与 scsynth 状态
node dist/cli.js check

# 运行 .scd（单次执行后退出）
node dist/cli.js run path/to/script.scd

# 失败时打印日志尾部
node dist/cli.js run path/to/script.scd --tail-logs 500

# 录制为 WAV（R1 包装）
node dist/cli.js render path/to/script.scd -o /tmp/out.wav -d 5

# 可选：全局安装
npm link
scctl check
```

### MCP 服务

stdio 方式启动：

```bash
node dist/mcp/server.js
```

**Claude Desktop** — 在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "supercollider": {
      "command": "node",
      "args": ["/absolute/path/to/supercollider-mcp/dist/mcp/server.js"]
    }
  }
}
```

| 工具 | 参数 | 说明 |
|------|------|------|
| `sc_check` | — | 检查 `sclang` 路径，并探测 scsynth 是否在运行 |
| `sc_eval` | `code`（必填） | 在持久会话中执行代码（保持打开） |
| `sc_run_file` | `path`（必填） | 读取并执行 `.scd` 文件（保持会话） |
| `sc_logs` | `tail`（可选） | 当前会话的 sclang post 输出 |
| `sc_render` | `out`（必填），`path` 或 `code`，`duration` | 录制 WAV；结束后总是关闭会话 |
| `sc_stop` | — | 停止合成并关闭 `sclang` |

### Agent 工作流

典型设计阶段循环：`sc_check` → `sc_eval` 或 `sc_run_file` → `sc_logs`（出错时）→ `sc_render` → `sc_stop`。

- `.scd` 与 WAV 输出请使用**绝对路径**（无默认工作目录）。
- SuperCollider 侧只写 SynthDef、播放与渲染片段；业务逻辑放在项目其他层。
- 持久日志 tail 仅 MCP（`sc_logs`）；CLI 为单次进程，失败时用 `run --tail-logs N`。

设计说明：[docs/design/scctl-scope-enhancement.md](docs/design/scctl-scope-enhancement.md)

### 冒烟测试（需本机安装 SuperCollider）

```bash
npm run build
node dist/cli.js check    # 应看到 STATUS、PATH、SERVER
node dist/cli.js render fixtures/smoke/sine-play.scd -o /tmp/scctl-smoke.wav -d 2
test -s /tmp/scctl-smoke.wav
```

本机失败请参阅 [docs/smoke-troubleshooting.md](docs/smoke-troubleshooting.md)。

### 示例脚本

```bash
node play-music.js    # 播放五声音阶示例（约 10 秒）
node record-music.js  # 录制到 ./music.wav
```

## 架构

```text
MCP client / CLI
       │
       ▼
src/mcp/server.ts  or  src/cli.ts
       │
       ▼
SclangController (src/runtime/sclang.ts)
       │  stdin/stdout delimiter protocol
       ▼
sclang → scsynth → audio output
```

要点：

- 每个 controller 对应一个 `sclang` 进程（独占音频设备）
- 仅串行执行——拒绝并发 `execute()`
- 关闭时发送 `CmdPeriod.run; Server.killAll;`，必要时 SIGKILL

背景：[docs/design/control-approach-notes.md](docs/design/control-approach-notes.md)

## 安全

`sc_eval` 会执行任意 SuperCollider 代码，可访问本机文件与进程。仅配合可信的本地 MCP 客户端使用，勿将 MCP 服务暴露到网络。

详见 [SECURITY.md](SECURITY.md)。

## 开发

```bash
npm run typecheck
npm run build
npm test
```

贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

ISC — 见 [LICENSE](LICENSE)。
