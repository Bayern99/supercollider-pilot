# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- P4 `sc_check` server probe (`server: running|not_running|unknown`) via `src/runtime/server-probe.ts`
- CLI `check` prints `SERVER:` line; docs/smoke-troubleshooting.md for local SC issues
- MCP `sc_logs` — tail sclang post buffer from active session
- MCP `sc_run_file` — evaluate `.scd` file in persistent session
- MCP `sc_render` — R1 wrapper record to WAV (`path` or `code`, `out`, `duration`)
- CLI `scctl render <file> -o <wav>` and `scctl run --tail-logs <n>`
- `readScdFile` helper (`src/runtime/sc-file.ts`) and `renderSession` (`src/runtime/render.ts`)
- Smoke fixture `fixtures/smoke/sine-play.scd`
- GitHub Actions CI, Dependabot, LICENSE, SECURITY.md, CONTRIBUTING.md
- `SclangControllerOptions`: execute timeout (default 120s), log buffer cap
- Example scripts: `play-music.js`, `record-music.js`
- Comprehensive README

### Changed

- `record-music.js` uses shared `renderSession()` (R1 wrapper)
- `sc_render` MCP description: Pdef/Routine duration, sc_eval for audition
- CI no longer installs SuperCollider; CLI tests are help/structure only (mock-based)

### Changed (prior)

- `wrapScCode()` uses string concatenation instead of template literals (injection fix)
- `stop()` rejects in-flight execute before shutdown; cleanup after process exit
- Example scripts use `s.boot; s.sync;` instead of async `waitForBoot`

### Fixed

- CI failure when Ubuntu runner ran real `scctl run` against headless sclang (SIGABRT)
- `wrapScCode()` runs user code in a `fork` so `s.sync` and `.wait` work in eval/render paths
- Execute hangs when delimiter appears on stderr
- Concurrent `boot()` could spawn multiple sclang processes
- `record-music.js` hardcoded absolute path replaced with `process.cwd()`

## [1.0.0] - 2026-06-09

### Added

- CLI: `scctl check`, `scctl run <file>`
- MCP server: `sc_check`, `sc_eval`, `sc_stop`
- Cross-platform `sclang` path discovery
- `SclangController` with delimiter-based execute protocol
- Vitest test suite

[Unreleased]: https://github.com/Bayern99/supercollider-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Bayern99/supercollider-mcp/releases/tag/v1.0.0
