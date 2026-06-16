# Repository Guidelines

## Project Structure & Module Organization

`src/` contains the TypeScript implementation. Keep process and SuperCollider control in `src/runtime/`, CLI/MCP adapters in `src/cli.ts`, `src/mcp/`, and `src/transport/`, and higher-level behavior in `src/workflow/`, `src/orchestration/`, `src/lab/`, `src/archive/`, `src/evals/`, and `src/planner/`. Governance contracts live in `src/harness/`.

Tests mirror these areas under `tests/` (for example, `src/runtime/driver.ts` maps to `tests/runtime/driver.test.ts`). SuperCollider sources and reviewed sound-family artifacts live in `sc/`; minimal integration fixtures live in `fixtures/`. Contributor and operator documentation is under `docs/`, while reusable agent instructions are under `.agents/skills/`.

## Build, Test, and Development Commands

- `npm ci`: install the locked dependency set; requires Node.js 22 or newer.
- `npm run typecheck`: validate strict TypeScript without emitting files.
- `npm run build`: compile production ESM output to `dist/`.
- `npm test`: run the Vitest suite once.
- `npm run test:watch`: rerun relevant tests during development.
- `npm run test:live`: run the optional live smoke test; requires local SuperCollider and discoverable `sclang`.
- `node scripts/harness-audit.js repo`: audit harness, documentation, and skill consistency.

Before opening a pull request, run typecheck, build, and the standard test suite.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: two-space indentation, single quotes, semicolons, trailing commas in multiline structures, and ESM imports with `.js` extensions. Use `camelCase` for functions and variables, `PascalCase` for classes and types, and kebab-case filenames such as `render-nrt-driver.ts`. Keep modules focused and do not bypass `ScDriver` to spawn `sclang` from workflow or transport code. No separate formatter or linter is configured, so match nearby code.

## Testing Guidelines

Vitest is the test framework. Name tests `*.test.ts` and place them in the matching domain directory. Mock process execution for unit tests; reserve real audio-engine coverage for `tests/live-smoke.test.ts`. Add regression tests for behavior changes and verify structured success, error, and recovery states.

## Commit & Pull Request Guidelines

Use concise Conventional Commit subjects, typically `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, or `chore(scope): ...`. Keep PRs focused, describe user-visible behavior, include a test plan, link relevant issues, and update `CHANGELOG.md` under `[Unreleased]` when behavior changes. Include screenshots or generated audio details only when they help reviewers evaluate output.

## Security & Local Execution

Treat `sc_eval` and `.scd` files as trusted local code: SuperCollider can access files and spawn processes. Never expose the MCP server to an untrusted network.
