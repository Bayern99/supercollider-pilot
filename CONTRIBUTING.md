# Contributing to supercollider-pilot

Thank you for your interest in contributing.

## Development setup

```bash
git clone https://github.com/Bayern99/supercollider-pilot.git
cd supercollider-pilot
npm install
npm run build
node dist/cli.js check   # requires SuperCollider installed
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check `src/` and `tests/` |
| `npm test` | Run Vitest suite |
| `npm run test:live` | Optional live SuperCollider smoke |
| `npm run test:watch` | Watch mode |
| `node scripts/harness-audit.js repo` | Harness / docs / skills audit (100-point rubric) |

## Pull request process

1. Fork the repository and create a feature branch from `main`
2. Make focused changes; match existing code style ([AGENTS.md](AGENTS.md) for module boundaries)
3. Ensure `npm run typecheck`, `npm run build`, and `npm test` pass locally
4. Update [CHANGELOG.md](CHANGELOG.md) under `[Unreleased]` for user-visible changes
5. Open a PR with a clear description and test plan

Feature integration checklist: [CONTRIBUTING.md](CONTRIBUTING.md) pull request process · [status.md](docs/superpowers/status.md) for baseline

## Commit messages

Use concise, imperative subject lines (Conventional Commits):

- `feat(harness): add sc_foo MCP tool`
- `fix(runtime): reject hung execute on stop`
- `docs: clarify consumer bootstrap`

## Tests

- Unit tests mock `child_process`; no SuperCollider required for most tests
- Live smoke: `SCCTL_RUN_LIVE_SMOKE=1` + local `sclang`
- CI installs SuperCollider on Ubuntu and runs the full suite

## Documentation map

| Audience | Start here |
|----------|------------|
| **Everyone** | **[docs/README.zh-CN.md](docs/README.zh-CN.md)** (full map) · [docs/README.md](docs/README.md) |
| Consumer project setup | [docs/guides/consumer-bootstrap.zh-CN.md](docs/guides/consumer-bootstrap.zh-CN.md) |
| Governed workflow | [docs/guides/governed-pilot-tutorial.zh-CN.md](docs/guides/governed-pilot-tutorial.zh-CN.md) |
| Operators | [docs/operator-runbook.md](docs/operator-runbook.md) |
| Code contributors | [AGENTS.md](AGENTS.md) |
| Design specs | [docs/README.zh-CN.md](docs/README.zh-CN.md) (design table) |
| Current progress | [docs/superpowers/status.md](docs/superpowers/status.md) |

## Design notes

See [docs/design/control-approach-notes.md](docs/design/control-approach-notes.md) for background on the control architecture.
