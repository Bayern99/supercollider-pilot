# supercollider-mcp

**MCP server for AI agents to control SuperCollider** — includes the `scctl` CLI.

[![CI](https://github.com/Bayern99/supercollider-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Bayern99/supercollider-mcp/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)

This project wraps the [SuperCollider](https://supercollider.github.io/) `sclang` interpreter as an [MCP](https://modelcontextprotocol.io) server so Claude Desktop, Cursor, and other clients can check installation, evaluate code, and shut down audio cleanly.

## Features

- Cross-platform `sclang` discovery (macOS, Windows, Linux, plus `PATH` fallback)
- Persistent `SclangController` with delimiter-based stdout/stderr parsing
- MCP tools: `sc_check`, `sc_eval`, `sc_run_file`, `sc_logs`, `sc_render`, `sc_stop`
- CLI: `scctl check`, `scctl run <file.scd>`, `scctl render <file.scd> -o out.wav`
- R1 render wrapper: boot → user code → record → wait → stop → verify WAV
- Graceful shutdown with SIGINT/SIGTERM handling and execute timeout (default 120s)
- Vitest coverage for discovery, runtime, CLI, and MCP routing

## Requirements

| Dependency | Version |
|------------|---------|
| Node.js | 22+ |
| SuperCollider | 3.13+ (`sclang` on `PATH` or default install location) |

Default `sclang` locations:

| Platform | Path |
|----------|------|
| macOS | `/Applications/SuperCollider.app/Contents/MacOS/sclang` |
| Windows | `C:\Program Files\SuperCollider\sclang.exe` |
| Linux | `/usr/bin/sclang` or `/usr/local/bin/sclang` |

## Install

```bash
git clone https://github.com/Bayern99/supercollider-mcp.git
cd supercollider-mcp
npm install
npm run build
```

Verify SuperCollider is reachable:

```bash
node dist/cli.js check
```

Expected output when installed:

```text
STATUS: OK
PATH: /Applications/SuperCollider.app/Contents/MacOS/sclang
```

## Usage

### CLI

```bash
# Check installation
node dist/cli.js check

# Run a .scd file (one-shot; exits after eval)
node dist/cli.js run path/to/script.scd

# On failure, print last N log characters
node dist/cli.js run path/to/script.scd --tail-logs 500

# Record a .scd file to WAV (R1 wrapper)
node dist/cli.js render path/to/script.scd -o /tmp/out.wav -d 5

# Optional global install
npm link
scctl check
```

### MCP server

Start the server (stdio transport):

```bash
node dist/mcp/server.js
```

**Claude Desktop** — add to `claude_desktop_config.json`:

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

| Tool | Parameters | Description |
|------|------------|-------------|
| `sc_check` | — | Return whether `sclang` is available and its path |
| `sc_eval` | `code` (required) | Evaluate code in a persistent session (stays open) |
| `sc_run_file` | `path` (required) | Read and evaluate a `.scd` file (session stays open) |
| `sc_logs` | `tail` (optional) | Recent sclang post output from the active session |
| `sc_render` | `out` (required), `path` or `code`, `duration` | Record to WAV; always stops session after |
| `sc_stop` | — | Stop synthesis, release audio, shut down `sclang` |

### Agent workflow

Typical design-phase loop: `sc_check` → `sc_eval` or `sc_run_file` → `sc_logs` (on error) → `sc_render` → `sc_stop`.

- Use **absolute paths** for `.scd` files and WAV output (no default cwd).
- Do not put formation/oracle/casting logic in SuperCollider code — only SynthDefs and playback.
- Persistent log tailing is **MCP-only** (`sc_logs`). The CLI is one-shot; use `run --tail-logs N` on failure.

Design spec: [docs/design/scctl-scope-enhancement.md](docs/design/scctl-scope-enhancement.md)

### Smoke test (requires local SuperCollider)

```bash
npm run build
node dist/cli.js check
node dist/cli.js render fixtures/smoke/sine-play.scd -o /tmp/scctl-smoke.wav -d 2
test -s /tmp/scctl-smoke.wav
```

### Examples

```bash
node play-music.js    # Play a generated pentatonic pattern (~10s)
node record-music.js  # Record output to ./music.wav
```

## Architecture

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

Key constraints:

- One `sclang` process per controller (single audio device owner)
- Serial execution only — concurrent `execute()` calls are rejected
- Shutdown sends `CmdPeriod.run; Server.killAll;` then SIGKILL if needed

See [docs/design/control-approach-notes.md](docs/design/control-approach-notes.md) for design background.

## Security

`sc_eval` runs arbitrary SuperCollider code with host filesystem and process access. Use only with trusted local MCP clients. Do not expose the MCP server on a network.

Details: [SECURITY.md](SECURITY.md).

## Development

```bash
npm run typecheck
npm run build
npm test
```

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

ISC — see [LICENSE](LICENSE).
